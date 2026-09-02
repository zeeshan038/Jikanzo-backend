import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index';

describe('Feed API endpoint', () => {
  it('should return 401 when no token is provided', async () => {
    const response = await request(app).get('/api/feed/get-feed');
    
    // Without an auth token, the verifyUser middleware should block the request
    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      status: false,
      msg: 'Not authorized, no token'
    });
  });
});
