import express from 'express';
import { getCompanionsFeed } from '../../controllers/user/feed';
import { verifyUser } from '../../middlewares/verifyUser';



const router = express.Router();


router.use(verifyUser)
router.get('/get-feed',getCompanionsFeed)

export default router;