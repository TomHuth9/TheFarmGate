export interface User {
  id: string;
  name: string;
  email: string;
  role: 'customer' | 'admin' | 'farm';
  farmName?: string;
}

export interface AuthResponse {
  user: User;
}

export interface Farm {
  _id: string;
  name: string;
  farmName: string;
  farmDescription: string;
  farmLocation: string;
}
