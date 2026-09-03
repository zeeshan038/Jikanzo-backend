import { Router } from 'express';
import { discoverPeople } from '../../controllers/user/discover';
import { verifyUser } from '../../middlewares/verifyUser';



const router = Router();


router.use(verifyUser)
router.get('/people', discoverPeople);

export default router;