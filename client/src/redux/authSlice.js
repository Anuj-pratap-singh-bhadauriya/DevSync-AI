import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  token: localStorage.getItem('authToken') || null,
  isAuthenticated: !!localStorage.getItem('authToken'),
  user: null, 
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginSuccess: (state, action) => {
      state.token = action.payload.token;
      state.isAuthenticated = true;
      localStorage.setItem('authToken', action.payload.token);
    },
    logout: (state) => {
      state.token = null;
      state.isAuthenticated = false;
      state.user = null;
      localStorage.removeItem('authToken');
    },
    // Reducer to securely store fetched user profile data
    setUser: (state, action) => {
      state.user = action.payload;
    }
  },
});

export const { loginSuccess, logout, setUser } = authSlice.actions; 
export default authSlice.reducer;