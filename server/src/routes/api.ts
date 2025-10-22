import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const router = Router();

/**
 * Auth/JWT
 * Simple JWT secret (in production, move to env)
 */
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

type AuthReq = Request & { user?: { id: string; email?: string } };

const authMiddleware = (req: AuthReq, res: Response, next: NextFunction) => {
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Missing token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = { id: decoded.sub as string, email: decoded.email as string | undefined };
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Prisma instance
const prisma = new PrismaClient();

// Utility types to keep API responses compatible with existing frontend
type Priority = 'low' | 'normal' | 'high';
const nowISO = () => new Date().toISOString();

// Helpers
const findSectionById = async (projectId: string, sectionId: string) => {
  return prisma.section.findFirst({ where: { id: sectionId, projectId } });
};

/**
 * Auth
 */
const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
});

router.post('/auth/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);
  try {
    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) return res.status(409).json({ message: 'Email already registered' });

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    // Use unchecked input to allow writing passwordHash explicitly
    const user = await prisma.user.create({
      data: { name: parsed.data.name, email: parsed.data.email, passwordHash } as any,
      select: { id: true, name: true, email: true, createdAt: true },
    });

    const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ user, token });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to register' });
  }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

router.post('/auth/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);
  try {
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    const ok = await bcrypt.compare(parsed.data.password, (user as any).passwordHash);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt }, token });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to login' });
  }
});

/**
 * Users listing for assignment
 */
router.get('/users', async (_req, res) => {
  try {
    const users = await prisma.user.findMany({ select: { id: true, name: true, email: true } });
    res.json(users);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to list users' });
  }
});

/**
 * Projects listing/creation (persisted via Prisma)
 */
router.get('/projects', async (_req, res) => {
  try {
    const projects = await prisma.project.findMany({ select: { id: true, title: true } });
    res.json(projects);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to list projects' });
  }
});

router.post('/projects', async (req, res) => {
  try {
    const { title } = (req.body ?? {}) as { title?: string };
    const proj = await prisma.project.create({
      data: { title: title || `project-${Date.now()}` },
      select: { id: true, title: true },
    });

    // Seed default sections
    const createdSections = await prisma.$transaction([
      prisma.section.create({ data: { title: 'Backlog', canDelete: false, projectId: proj.id } }),
      prisma.section.create({ data: { title: 'To Do', canDelete: true, projectId: proj.id } }),
      prisma.section.create({ data: { title: 'Review', canDelete: true, projectId: proj.id } }),
      prisma.section.create({ data: { title: 'Done', canDelete: true, projectId: proj.id } }),
    ]);

    res.status(201).json({ id: proj.id, title: proj.title });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to create project' });
  }
});

/**
 * Board routes, namespaced by project
 * Compose a Board shape from DB
 */
router.get('/projects/:projectId/board', async (req, res) => {
  const { projectId } = req.params;
  try {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const sections = await prisma.section.findMany({
      where: { projectId },
      orderBy: { title: 'asc' },
    });

    const cards = await prisma.card.findMany({
      where: { section: { projectId } },
      orderBy: { createdAt: 'asc' },
      include: { comments: true, section: true, assignees: { select: { id: true, name: true, email: true } } } as any,
    });

    const bySection: Record<string, any[]> = {};
    sections.forEach(s => (bySection[s.id] = []));
    for (const c of cards) {
      bySection[c.sectionId]?.push({
        id: c.id,
        title: c.title,
        description: c.description,
        priority: c.priority as Priority,
        executor: c.executor,
        comments: c.comments.map(cm => ({
          id: cm.id,
          text: cm.text,
          createdAt: new Date(cm.createdAt).toISOString(),
        })),
        createdAt: new Date(c.createdAt).toISOString(),
        sectionId: c.sectionId,
        assignees: c.assignees,
      });
    }

    const board = {
      id: `${projectId}-board`,
      title: project.title,
      sections: sections.map(s => ({
        id: s.id,
        title: s.title,
        canDelete: s.canDelete,
        cards: (bySection[s.id] || []),
      })),
    };

    res.json(board);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to load board' });
  }
});

const createSectionSchema = z.object({ title: z.string().min(1) });

router.post('/projects/:projectId/sections', async (req, res) => {
  const { projectId } = req.params;
  const parsed = createSectionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);
  try {
    // verify project exists
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const created = await prisma.section.create({
      data: { title: parsed.data.title, canDelete: true, projectId },
    });
    res.status(201).json({ id: created.id, title: created.title, cards: [], canDelete: created.canDelete });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to create section' });
  }
});

router.delete('/projects/:projectId/sections/:id', async (req, res) => {
  const { projectId, id } = req.params;
  try {
    const section = await prisma.section.findFirst({ where: { id, projectId } });
    if (!section) return res.status(404).json({ message: 'Section not found' });
    if (!section.canDelete) return res.status(400).json({ message: 'Backlog cannot be deleted' });

    // Delete all cards (and their comments) that belong to this section, then delete the section
    const cardsInSection = await prisma.card.findMany({ where: { sectionId: id }, select: { id: true } });
    const cardIds = cardsInSection.map(c => c.id);

    await prisma.$transaction([
      prisma.comment.deleteMany({ where: { cardId: { in: cardIds } } }),
      prisma.card.deleteMany({ where: { id: { in: cardIds } } }),
      prisma.section.delete({ where: { id } }),
    ]);

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to delete section' });
  }
});

router.post('/projects/:projectId/sections/:id/clear', async (req, res) => {
  const { projectId, id } = req.params;
  try {
    const section = await prisma.section.findFirst({ where: { id, projectId } });
    if (!section) return res.status(404).json({ message: 'Section not found' });

    // Hard-delete all cards in the section and their comments
    const cardsInSection = await prisma.card.findMany({ where: { sectionId: id }, select: { id: true } });
    const cardIds = cardsInSection.map(c => c.id);
    if (cardIds.length) {
      await prisma.$transaction([
        prisma.comment.deleteMany({ where: { cardId: { in: cardIds } } }),
        prisma.card.deleteMany({ where: { id: { in: cardIds } } }),
      ]);
    }

    res.json({ id: section.id, title: section.title, canDelete: section.canDelete, cards: [] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to clear section' });
  }
});

router.post('/projects/:projectId/sections/delete-all', async (req, res) => {
  const { projectId } = req.params;
  try {
    const sections = await prisma.section.findMany({ where: { projectId } });
    const backlog = sections.find(s => s.title === 'Backlog');
    if (!backlog) return res.status(400).json({ message: 'Backlog section missing' });

    const deletable = sections.filter(s => s.canDelete);
    await prisma.$transaction([
      prisma.card.updateMany({
        where: { sectionId: { in: deletable.map(s => s.id) } },
        data: { sectionId: backlog.id },
      }),
      prisma.section.deleteMany({ where: { id: { in: deletable.map(s => s.id) } } }),
    ]);

    res.json([{ id: backlog.id, title: backlog.title, canDelete: backlog.canDelete, cards: [] }]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to delete all sections' });
  }
});

const createCardSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().default(''),
  priority: z.enum(['low', 'normal', 'high']),
  executor: z.string().optional().default(''),
});

router.post('/projects/:projectId/sections/:sectionId/cards', async (req, res) => {
  const { projectId, sectionId } = req.params;
  const parsed = createCardSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  try {
    const section = await findSectionById(projectId, sectionId);
    if (!section) return res.status(404).json({ message: 'Section not found' });

    const created = await prisma.card.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        priority: parsed.data.priority,
        executor: parsed.data.executor,
        sectionId,
      },
    });

    res.status(201).json({
      id: created.id,
      title: created.title,
      description: created.description,
      priority: created.priority as Priority,
      executor: created.executor,
      comments: [],
      createdAt: created.createdAt.toISOString(),
      sectionId: created.sectionId,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to add card' });
  }
});

const updateCardSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().default(''),
  priority: z.enum(['low', 'normal', 'high']),
  executor: z.string().optional().default(''),
  sectionId: z.string().optional()
});

router.put('/projects/:projectId/cards/:cardId', async (req, res) => {
  const { projectId, cardId } = req.params;
  const parsed = updateCardSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  try {
    // validate target section if provided
    if (parsed.data.sectionId) {
      const sec = await findSectionById(projectId, parsed.data.sectionId);
      if (!sec) return res.status(400).json({ message: 'Target section not found' });
    }

    const updated = await prisma.card.update({
      where: { id: cardId },
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        priority: parsed.data.priority,
        executor: parsed.data.executor,
        sectionId: parsed.data.sectionId ?? undefined,
      },
      include: { comments: true, assignees: { select: { id: true, name: true, email: true } } } as any,
    });

    res.json({
      id: updated.id,
      title: updated.title,
      description: updated.description,
      priority: updated.priority as Priority,
      executor: updated.executor,
      comments: updated.comments.map(cm => ({ id: cm.id, text: cm.text, createdAt: cm.createdAt.toISOString() })),
      createdAt: updated.createdAt.toISOString(),
      sectionId: updated.sectionId,
      assignees: updated.assignees,
    });
  } catch (e) {
    console.error(e);
    res.status(404).json({ message: 'Card not found' });
  }
});

router.delete('/projects/:projectId/cards/:cardId', async (req, res) => {
  const { cardId } = req.params;
  try {
    await prisma.comment.deleteMany({ where: { cardId } });
    await prisma.card.delete({ where: { id: cardId } });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(404).json({ message: 'Card not found' });
  }
});

const moveSchema = z.object({ targetSectionId: z.string().min(1) });

router.post('/projects/:projectId/cards/:cardId/move', async (req, res) => {
  const { projectId, cardId } = req.params;
  const parsed = moveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  try {
    const to = await findSectionById(projectId, parsed.data.targetSectionId);
    if (!to) return res.status(400).json({ message: 'Target section not found' });

    const moved = await prisma.card.update({
      where: { id: cardId },
      data: { sectionId: to.id },
      include: { comments: true, assignees: { select: { id: true, name: true, email: true } } } as any,
    });

    res.json({
      id: moved.id,
      title: moved.title,
      description: moved.description,
      priority: moved.priority as Priority,
      executor: moved.executor,
      comments: moved.comments.map(cm => ({ id: cm.id, text: cm.text, createdAt: cm.createdAt.toISOString() })),
      createdAt: moved.createdAt.toISOString(),
      sectionId: moved.sectionId,
      assignees: moved.assignees,
    });
  } catch (e) {
    console.error(e);
    res.status(404).json({ message: 'Card not found' });
  }
});

// Comments
const commentSchema = z.object({ text: z.string().min(1) });

router.get('/projects/:projectId/cards/:cardId/comments', async (req, res) => {
  const { projectId, cardId } = req.params;
  try {
    // ensure card belongs to project
    const card = await prisma.card.findFirst({ where: { id: cardId, section: { projectId } } });
    if (!card) return res.status(404).json({ message: 'Card not found' });

    const comments = await prisma.comment.findMany({
      where: { cardId },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { id: true, name: true, email: true } } } as any,
    });
    res.json(comments.map(c => ({
      id: c.id,
      text: c.text,
      createdAt: c.createdAt.toISOString(),
      author: c.author,
    })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to load comments' });
  }
});

router.post('/projects/:projectId/cards/:cardId/comments', authMiddleware, async (req: AuthReq, res) => {
  const { projectId, cardId } = req.params;
  const parsed = commentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  try {
    const card = await prisma.card.findFirst({ where: { id: cardId, section: { projectId } } });
    if (!card) return res.status(404).json({ message: 'Card not found' });

    const userId = req.user!.id;
    const created = await prisma.comment.create({
      data: {
        text: parsed.data.text,
        cardId: card.id,
        authorId: userId,
      } as any, // satisfy Prisma typing for unchecked create to allow direct FKs
    });
    // fetch author to include in response
    const author = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true }
    });
    res.status(201).json({
      id: created.id,
      text: created.text,
      createdAt: created.createdAt.toISOString(),
      author,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to create comment' });
  }
});

/**
 * Comment edit/delete with ownership check
 */
const commentUpdateSchema = z.object({ text: z.string().min(1) });

router.put('/projects/:projectId/comments/:commentId', authMiddleware, async (req: AuthReq, res) => {
  const { commentId, projectId } = req.params;
  const parsed = commentUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);
  try {
    // ensure comment belongs to a card in project
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: { card: { include: { section: true } } } as any,
    }) as any;
    if (!comment || comment.card.section.projectId !== projectId) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    if (comment.authorId !== req.user!.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const updated = await prisma.comment.update({
      where: { id: commentId },
      data: { text: parsed.data.text },
    });
    res.json({
      id: updated.id,
      text: updated.text,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to update comment' });
  }
});

router.delete('/projects/:projectId/comments/:commentId', authMiddleware, async (req: AuthReq, res) => {
  const { commentId, projectId } = req.params;
  try {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: { card: { include: { section: true } } } as any,
    }) as any;
    if (!comment || comment.card.section.projectId !== projectId) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    if (comment.authorId !== req.user!.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    await prisma.comment.delete({ where: { id: commentId } });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to delete comment' });
  }
});

/**
 * Card assignees
 */
const assigneeSchema = z.object({ userId: z.string().min(1) });

router.post('/projects/:projectId/cards/:cardId/assignees', async (req, res) => {
  const { projectId, cardId } = req.params;
  const parsed = assigneeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);
  try {
    const card = await prisma.card.findFirst({ where: { id: cardId, section: { projectId } } });
    if (!card) return res.status(404).json({ message: 'Card not found' });

    await prisma.card.update({
      where: { id: cardId },
      data: { assignees: { connect: { id: parsed.data.userId } } } as any,
    });

    const updated = await prisma.card.findUnique({
      where: { id: cardId },
      include: { assignees: { select: { id: true, name: true, email: true } } } as any,
    });

    res.status(201).json({ assignees: updated?.assignees ?? [] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to assign user' });
  }
});

router.delete('/projects/:projectId/cards/:cardId/assignees/:userId', async (req, res) => {
  const { projectId, cardId, userId } = req.params;
  try {
    const card = await prisma.card.findFirst({ where: { id: cardId, section: { projectId } } });
    if (!card) return res.status(404).json({ message: 'Card not found' });

    await prisma.card.update({
      where: { id: cardId },
      data: { assignees: { disconnect: { id: userId } } } as any,
    });

    const updated = await prisma.card.findUnique({
      where: { id: cardId },
      include: { assignees: { select: { id: true, name: true, email: true } } } as any,
    });

    res.json({ assignees: updated?.assignees ?? [] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to unassign user' });
  }
});

// Bulk delete by label
const bulkSchema = z.object({
  scope: z.enum(['section', 'all']),
  sectionId: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high'])
});

router.post('/projects/:projectId/cards/bulk-delete', async (req, res) => {
  const { projectId } = req.params;
  const parsed = bulkSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  try {
    let count = 0;
    if (parsed.data.scope === 'section') {
      if (!parsed.data.sectionId) return res.status(400).json({ message: 'sectionId required for section scope' });
      const section = await prisma.section.findFirst({ where: { id: parsed.data.sectionId, projectId } });
      if (!section) return res.status(404).json({ message: 'Section not found' });

      const toDelete = await prisma.card.findMany({
        where: { sectionId: section.id, priority: parsed.data.priority },
        select: { id: true },
      });
      const ids = toDelete.map(c => c.id);
      if (ids.length) {
        await prisma.$transaction([
          prisma.comment.deleteMany({ where: { cardId: { in: ids } } }),
          prisma.card.deleteMany({ where: { id: { in: ids } } }),
        ]);
      }
      count = ids.length;
    } else {
      // scope === 'all' across project
      const toDelete = await prisma.card.findMany({
        where: { section: { projectId }, priority: parsed.data.priority },
        select: { id: true },
      });
      const ids = toDelete.map(c => c.id);
      if (ids.length) {
        await prisma.$transaction([
          prisma.comment.deleteMany({ where: { cardId: { in: ids } } }),
          prisma.card.deleteMany({ where: { id: { in: ids } } }),
        ]);
      }
      count = ids.length;
    }
    res.json({ deleted: count });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed bulk delete' });
  }
});
