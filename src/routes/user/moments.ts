import express from 'express';
import { 
    createMoment, 
    getFeedMoments, 
    deleteMoment, 
    appreciateMoment,
    markMomentAsSeen,
    getCompanionMoments
} from '../../controllers/user/moments';
import { verifyUser } from '../../middlewares/verifyUser';

const router = express.Router();

router.use(verifyUser);

router.post('/create', createMoment);
router.get('/feed', getFeedMoments);
router.get('/all', getCompanionMoments);
router.post('/:id/appreciate', appreciateMoment);
router.post('/seen/:id', markMomentAsSeen);
router.delete('/:id', deleteMoment);

export default router;
