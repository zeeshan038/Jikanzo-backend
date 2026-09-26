import express from 'express';
import {
    getCompanionsFeed,
    saveCompanion,
    getSavedCompanions,
    logImpression,
    logImpressionBulk,
    specificCompanion
} from '../../controllers/user/feed';
import { verifyUser } from '../../middlewares/verifyUser';

const router = express.Router();

router.use(verifyUser);

router.get('/get-feed', getCompanionsFeed);
router.get('/specific/:userId', specificCompanion);
router.post('/save-companion', saveCompanion);
router.get('/saved-companions', getSavedCompanions);
router.post('/impression', logImpression);
router.post('/impression/bulk', logImpressionBulk)

export default router;