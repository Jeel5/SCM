import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT;
const API_PREFIX = '/api';

import usersRoutes from './routes/users.js';
import mdmRoutes from './routes/mdm.js';
import ordersRoutes from './routes/orders.js';
import inventoryRoutes from './routes/inventory.js';
import shipmentsRoutes from './routes/shipments.js';
import slaRoutes from './routes/sla.js';
import returnsRoutes from './routes/returns.js';
import jobsRoutes from './routes/jobs.js';

app.use(helmet());
app.use(
	cors({
		origin: process.env.ALLOWED_ORIGINS,
		methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
	})
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
	res.status(200).json({ status: 'ok' });
});
app.use(API_PREFIX, usersRoutes);
app.use(API_PREFIX, mdmRoutes);
app.use(API_PREFIX, ordersRoutes);
app.use(API_PREFIX, inventoryRoutes);
app.use(API_PREFIX, shipmentsRoutes);
app.use(API_PREFIX, slaRoutes);
app.use(API_PREFIX, returnsRoutes);
app.use(API_PREFIX, jobsRoutes);

app.use((req, res) => {
	res.status(404).json({ error: 'Not Found' });
});

app.use((err, req, res, next) => {
	res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});
