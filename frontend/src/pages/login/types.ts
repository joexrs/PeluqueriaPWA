export interface LoginPayload {
  email: string;
  password: string;
  remember: boolean;
}

export interface LoginState {
  email: string;
  password: string;
  remember: boolean;
}
