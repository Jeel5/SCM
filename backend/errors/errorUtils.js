// Shared error helper used by services to enforce existence checks.

import { NotFoundError } from './AppError.js';

// Check if resource exists, throw 404 if not
export function assertExists(resource, name = 'Resource') {
  if (!resource) {
    throw new NotFoundError(name);
  }
  return resource;
}
