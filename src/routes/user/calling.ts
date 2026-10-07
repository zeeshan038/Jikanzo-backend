import express from 'express';
import { verifyUser } from '../../middlewares/verifyUser';
import {
  acceptCall,
  createCall,
  endCall,
  getCallHistory,
  getCallingConfig,
  getCallingStatus,
  rejectCall,
} from '../../controllers/user/calling';

const router = express.Router();

router.use(verifyUser);

router.get('/:id/status', getCallingStatus);
router.get('/:id/config', getCallingConfig);
router.get('/:id/history', getCallHistory);
router.post('/:id/calls', createCall);
router.post('/:id/calls/:callId/accept', acceptCall);
router.post('/:id/calls/:callId/reject', rejectCall);
router.post('/:id/calls/:callId/end', endCall);

export default router;
