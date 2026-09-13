import express from 'express';
import { 
    getAvailability, 
    updateWeeklySchedule, 
    updateSettings, 
    addOneTimeAvailability, 
    deleteOneTimeAvailability, 
    addBlockedDate, 
    deleteBlockedDate 
} from '../../controllers/user/availability';
import { verifyUser } from '../../middlewares/verifyUser';

const router = express.Router();

// All availability routes require authentication
router.use(verifyUser);

router.get('/get-availability', getAvailability);
router.put('/weekly-schedule', updateWeeklySchedule);
router.put('/settings', updateSettings);
router.post('/one-time', addOneTimeAvailability);
router.delete('/one-time/:id', deleteOneTimeAvailability);
router.post('/blocked-date', addBlockedDate);
router.delete('/blocked-date/:id', deleteBlockedDate);

export default router;
