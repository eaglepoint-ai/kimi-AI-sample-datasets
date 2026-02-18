export type Book = {
  id: number;
  title: string;
  copiesTotal: number;
  copiesAvailable: number;
};

export type Hold = {
  id: number;
  bookId: number;
  email: string;
  position: number; // stable, 1-based
  frozen: boolean;
  fulfilled: boolean;
};

export type StoreData = {
  counters: {
    bookId: number;
    holdId: number;
  };
  books: Book[];
  holds: Hold[];
};

export type AssignmentResult = {
  assignedHoldIds: number[];
};
