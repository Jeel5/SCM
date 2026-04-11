import express from 'express';
import { validateRequest } from '../validators/index.js';
import { requestDemoSchema, contactMessageSchema } from '../validators/publicSchemas.js';
import {
	requestDemo,
	contactMessage,
	getPublicOrganizations,
	getPublicOrganizationCarriers,
} from '../controllers/publicController.js';

const router = express.Router();

router.post('/public/request-demo', validateRequest(requestDemoSchema), requestDemo);
router.post('/public/contact-message', validateRequest(contactMessageSchema), contactMessage);
router.get('/public/organizations', getPublicOrganizations);
router.get('/public/organizations/:organizationId/carriers', getPublicOrganizationCarriers);

export default router;