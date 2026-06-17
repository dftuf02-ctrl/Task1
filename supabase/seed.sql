-- ============================================================
-- Seed data for tasks table
-- ============================================================

INSERT INTO tasks (title, description, due_date, status) VALUES
  (
    'Set up project infrastructure',
    'Initialize the repository, configure CI/CD pipeline, and set up Docker containers for the development environment.',
    NOW() + INTERVAL '7 days',
    'COMPLETED'
  ),
  (
    'Design database schema',
    'Create the PostgreSQL schema for the task management system including tables, indexes, and constraints.',
    NOW() + INTERVAL '3 days',
    'COMPLETED'
  ),
  (
    'Implement REST API endpoints',
    'Build CRUD endpoints for task management with proper validation, error handling, and response formatting.',
    NOW() + INTERVAL '10 days',
    'IN_PROGRESS'
  ),
  (
    'Write unit and integration tests',
    'Achieve at least 90% test coverage with comprehensive unit tests for services and integration tests for API endpoints.',
    NOW() + INTERVAL '14 days',
    'IN_PROGRESS'
  ),
  (
    'Build React frontend dashboard',
    'Create a modern, responsive dashboard UI with task list, filters, and CRUD operations.',
    NOW() + INTERVAL '21 days',
    'PENDING'
  ),
  (
    'Security audit and hardening',
    'Review OWASP Top 10, implement rate limiting, input sanitization, and security headers.',
    NOW() + INTERVAL '28 days',
    'PENDING'
  ),
  (
    'Write API documentation',
    'Document all endpoints, request/response formats, and provide usage examples in the README.',
    NOW() + INTERVAL '30 days',
    'PENDING'
  );
