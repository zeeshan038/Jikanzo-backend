import express from 'express';
import { createMoment, getFeedMoments, deleteMoment, appreciateMoment } from '../../controllers/user/moments';
import { verifyUser } from '../../middlewares/verifyUser';

const router = express.Router();

router.use(verifyUser);

router.post('/create', createMoment);
router.get('/feed', getFeedMoments);
router.post('/:id/appreciate', appreciateMoment);
router.delete('/:id', deleteMoment);

export default router;
