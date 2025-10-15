import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Route imports (to be implemented)
import usersRouter from './routes/users.js';
import vendorsRouter from './routes/vendors.js';
import productsRouter from './routes/products.js';
import ordersRouter from './routes/orders.js';
import paymentsRouter from './routes/payments.js';
import adminSessionsRouter from './routes/adminSessions.js';
import adminRouter from './routes/admin.js';
import vendorDashboardRouter from './routes/vendorDashboard.js';
import notificationsRouter from './routes/notifications.js';
import uploadRouter from './routes/upload.js';
import path from 'path';

app.use('/api/users', usersRouter);
app.use('/api/vendors', vendorsRouter);
app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/admin-sessions', adminSessionsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/vendor', vendorDashboardRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/upload', uploadRouter);
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.get('/', (req, res) => {
  res.send('Poultry Hub Backend API');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 