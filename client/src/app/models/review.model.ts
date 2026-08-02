export interface Review {
  _id: string;
  product: string;
  user: { _id: string; name: string };
  rating: number;
  body: string;
  createdAt: string;
}

export interface ReviewPage {
  reviews: Review[];
  total: number;
  page: number;
  pages: number;
  avgRating: number | null;
  count: number;
}
