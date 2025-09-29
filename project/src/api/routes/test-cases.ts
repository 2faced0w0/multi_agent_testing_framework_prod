import { Router, Request, Response } from 'express';
import { ensureDatabaseInitialized, getDatabaseManager } from '@api/context';
import { TestCaseRepository } from '@database/repositories/TestCaseRepository';
import { metrics } from '@monitoring/Metrics';

const router = Router();

function validatePayload(body: any, partial = false) {
  const errors: string[] = [];
  if (!partial) {
    if (!body?.title || typeof body.title !== 'string') errors.push('Missing or invalid field: title');
  } else {
    if (body?.title !== undefined && typeof body.title !== 'string') errors.push('Invalid field: title');
  }
  if (body?.status && !['active', 'deprecated', 'draft'].includes(body.status)) errors.push('Invalid field: status');
  return errors;
}

router.get('/', async (_req: Request, res: Response) => {
  const t0 = Date.now();
  try {
    await ensureDatabaseInitialized();
    const repo = new TestCaseRepository(getDatabaseManager().getDatabase());
    const items = await repo.list({});
    metrics.inc('api_test_cases_list_total');
    const dt = Date.now() - t0;
    if (dt < 100) metrics.inc('api_test_cases_list_lt_100ms');
    else if (dt < 300) metrics.inc('api_test_cases_list_lt_300ms');
    else if (dt < 1000) metrics.inc('api_test_cases_list_lt_1000ms');
    else metrics.inc('api_test_cases_list_ge_1000ms');
    return res.json({ items });
  } catch (err: any) {
    metrics.inc('api_test_cases_list_errors_total');
    return res.status(500).json({ error: 'Failed to list test cases', details: err?.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  const t0 = Date.now();
  try {
    await ensureDatabaseInitialized();
    const repo = new TestCaseRepository(getDatabaseManager().getDatabase());
    const item = await repo.findById(req.params.id);
    if (!item) { metrics.inc('api_test_cases_get_not_found_total'); return res.status(404).json({ error: 'Not found' }); }
    metrics.inc('api_test_cases_get_total');
    const dt = Date.now() - t0;
    if (dt < 100) metrics.inc('api_test_cases_get_lt_100ms');
    else if (dt < 300) metrics.inc('api_test_cases_get_lt_300ms');
    else if (dt < 1000) metrics.inc('api_test_cases_get_lt_1000ms');
    else metrics.inc('api_test_cases_get_ge_1000ms');
    return res.json(item);
  } catch (err: any) {
    metrics.inc('api_test_cases_get_errors_total');
    return res.status(500).json({ error: 'Failed to fetch test case', details: err?.message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  const errors = validatePayload(req.body);
  if (errors.length) { metrics.inc('api_test_cases_create_invalid_total'); return res.status(400).json({ error: 'Invalid input', details: errors }); }

  try {
    await ensureDatabaseInitialized();
    const repo = new TestCaseRepository(getDatabaseManager().getDatabase());
    const now = new Date().toISOString();
    const row = {
      id: req.body.id || (require('uuid').v4()),
      title: req.body.title,
      description: req.body.description || null,
      repo: req.body.repo || null,
      path: req.body.path || null,
      status: req.body.status || 'active',
      created_at: now,
      updated_at: now,
      created_by: req.body.created_by || 'api',
      metadata: req.body.metadata || {},
    } as any;
    await repo.create(row);
    metrics.inc('api_test_cases_create_total');
    return res.status(201).json(row);
  } catch (err: any) {
    metrics.inc('api_test_cases_create_errors_total');
    return res.status(500).json({ error: 'Failed to create test case', details: err?.message });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  const errors = validatePayload(req.body, true);
  if (errors.length) { metrics.inc('api_test_cases_update_invalid_total'); return res.status(400).json({ error: 'Invalid input', details: errors }); }
  try {
    await ensureDatabaseInitialized();
    const repo = new TestCaseRepository(getDatabaseManager().getDatabase());
    const id = req.params.id;
    const existing = await repo.findById(id);
    if (!existing) { metrics.inc('api_test_cases_update_not_found_total'); return res.status(404).json({ error: 'Not found' }); }
    await repo.update({
      id,
      title: req.body.title,
      description: req.body.description,
      repo: req.body.repo,
      path: req.body.path,
      status: req.body.status,
      updated_at: new Date().toISOString(),
      metadata: req.body.metadata,
      created_by: req.body.created_by,
    } as any);
    metrics.inc('api_test_cases_update_total');
    const updated = await repo.findById(id);
    return res.json(updated);
  } catch (err: any) {
    metrics.inc('api_test_cases_update_errors_total');
    return res.status(500).json({ error: 'Failed to update test case', details: err?.message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await ensureDatabaseInitialized();
    const repo = new TestCaseRepository(getDatabaseManager().getDatabase());
    const id = req.params.id;
    const existing = await repo.findById(id);
    if (!existing) { metrics.inc('api_test_cases_delete_not_found_total'); return res.status(404).json({ error: 'Not found' }); }
    await repo.delete(id);
    metrics.inc('api_test_cases_delete_total');
    return res.status(204).send();
  } catch (err: any) {
    metrics.inc('api_test_cases_delete_errors_total');
    return res.status(500).json({ error: 'Failed to delete test case', details: err?.message });
  }
});

export default router;