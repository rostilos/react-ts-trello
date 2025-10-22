export type Priority = 'low' | 'normal' | 'high';

export interface CommentAuthor {
  id: string;
  name: string;
  email: string;
}

export interface Comment {
  id: string;
  text: string;
  createdAt: Date;
  author?: CommentAuthor;
}

export interface UserLite {
  id: string;
  name: string;
  email: string;
}

export interface Card {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  executor: string;
  comments: Comment[];
  createdAt: Date;
  sectionId: string;
  assignees?: UserLite[];
}

export interface Section {
  id: string;
  title: string;
  cards: Card[];
  canDelete: boolean;
}

export interface Board {
  id: string;
  title: string;
  sections: Section[];
}
