import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../hooks/useAuth';
import LoginPage from './LoginPage';

describe('LoginPage', () => {
  it('renders sign in', () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </BrowserRouter>,
    );
    expect(screen.getByRole('heading', { name: /sign in/i })).toBeTruthy();
  });
});
