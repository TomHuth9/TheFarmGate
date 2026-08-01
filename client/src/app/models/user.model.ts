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

export interface AdminUser {
  _id: string;
  name: string;
  email: string;
  role: 'customer' | 'farm' | 'admin';
  farmName?: string;
  createdAt: string;
}

export interface Farm {
  _id: string;
  name: string;
  farmName: string;
  farmDescription: string;
  farmLocation: string;
}

export interface FarmProfile {
  _id: string;
  name: string;
  email: string;
  role: 'farm';
  farmName?: string;
  farmDescription?: string;
  farmLocation?: string;
}
