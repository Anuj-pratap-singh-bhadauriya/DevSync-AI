const express = require('express');
const router = express.Router();
const fetchuser = require('../middleware/fetchuser');
const checkMembership = require('../middleware/checkMembership');
const invitationController = require('../controllers/invitation.controller');

router.post('/projects/:id/invite', fetchuser, checkMembership, invitationController.invite);
router.get('/projects/:id/invite-requests', fetchuser, invitationController.getRequests);
router.post('/invites/:id/approve', fetchuser, invitationController.approve);
router.post('/invites/:id/deny', fetchuser, invitationController.deny);
router.get('/invitations', fetchuser, invitationController.listPending);
router.post('/invitations/:id/accept', fetchuser, invitationController.accept);
router.post('/invitations/:id/reject', fetchuser, invitationController.reject);

module.exports = router;
