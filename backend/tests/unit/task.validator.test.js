const { createTaskSchema, updateTaskSchema } = require('../../src/models/task.model');

describe('Task Validation Schemas (Zod)', () => {
  describe('createTaskSchema', () => {
    it('should validate a valid task payload', () => {
      const payload = {
        title: 'Learn Express MVC',
        description: 'Understand models, views, and controllers',
        due_date: new Date(Date.now() + 86400000).toISOString(),
        status: 'IN_PROGRESS',
      };

      const result = createTaskSchema.safeParse(payload);
      expect(result.success).toBe(true);
      expect(result.data.title).toBe(payload.title);
      expect(result.data.status).toBe('IN_PROGRESS');
    });

    it('should set default status to PENDING if not provided', () => {
      const payload = { title: 'Do laundry' };
      const result = createTaskSchema.safeParse(payload);
      expect(result.success).toBe(true);
      expect(result.data.status).toBe('PENDING');
    });

    it('should fail if title is missing', () => {
      const payload = { description: 'Only description' };
      const result = createTaskSchema.safeParse(payload);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('Title is required');
    });

    it('should fail if title exceeds 255 characters', () => {
      const payload = { title: 'a'.repeat(256) };
      const result = createTaskSchema.safeParse(payload);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('Title must be at most 255 characters');
    });

    it('should fail on invalid status', () => {
      const payload = { title: 'Invalid status task', status: 'UNKNOWN' };
      const result = createTaskSchema.safeParse(payload);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('Status must be one of: PENDING, IN_PROGRESS, COMPLETED');
    });

    it('should fail on invalid due_date format', () => {
      const payload = { title: 'Invalid date task', due_date: '2026-06-17' }; // Not ISO datetime string
      const result = createTaskSchema.safeParse(payload);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('due_date must be a valid ISO 8601 date');
    });
  });

  describe('updateTaskSchema', () => {
    it('should validate partial updates', () => {
      const payload = { status: 'COMPLETED' };
      const result = updateTaskSchema.safeParse(payload);
      expect(result.success).toBe(true);
      expect(result.data.status).toBe('COMPLETED');
    });

    it('should fail if title is empty string', () => {
      const payload = { title: '' };
      const result = updateTaskSchema.safeParse(payload);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('Title cannot be empty');
    });
  });
});
