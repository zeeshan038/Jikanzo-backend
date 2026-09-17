import express from 'express';
import { addReview } from '../../controllers/user/review';
import { verifyUser } from '../../middlewares/verifyUser';

const router = express.Router();

router.use(verifyUser);
router.post('/', addReview);

export default router;
