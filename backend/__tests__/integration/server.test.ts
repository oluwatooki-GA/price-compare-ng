import { describe, test, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server';
import { Application } from 'express';

describe('Server Setup', () => {
  let app: Application;

  beforeAll(() => { app = createApp(); });

  test('health check endpoint returns 200', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('timestamp');
  });

  test('CORS headers are set correctly', async () => {
    const response = await request(app)
      .options('/health')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'GET');
    expect(response.headers['access-control-allow-origin']).toBeDefined();
  });

  test('JSON body parser is configured', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'test@example.com', password: 'testpassword123' })
      .set('Content-Type', 'application/json');
    expect(response.status).not.toBe(415);
  });

  test('error handler catches unknown routes', async () => {
    const response = await request(app).get('/nonexistent-route');
    expect(response.status).toBe(404);
  });

  test('auth routes are registered', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'password' });
    expect(response.status).not.toBe(404);
  });

  test('search routes are registered', async () => {
    const response = await request(app)
      .post('/api/v1/search/keyword')
      .send({ keyword: 'test' });
    expect(response.status).not.toBe(404);
  });

  test('comparison routes are registered', async () => {
    const response = await request(app).get('/api/v1/comparisons');
    expect(response.status).not.toBe(404);
  });

  test('jobs routes are registered', async () => {
    const response = await request(app).get('/api/v1/jobs/nonexistent');
    expect(response.status).not.toBe(404);
  });
});
