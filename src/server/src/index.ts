import express from 'express';
import cors from 'cors';
import apiRouter from './routes/api';
import 'dotenv/config';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
// Increase payload size limit for base64 video data, matching client-side limit
app.use(express.json({ limit: '600mb' }));

app.use('/api', apiRouter);

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
