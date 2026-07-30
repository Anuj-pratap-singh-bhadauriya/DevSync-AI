const express = require('express');
const router = express.Router();
const fetchuser = require('../middleware/fetchuser');
const checkMembership = require('../middleware/checkMembership');
const projectController = require('../controllers/project.controller');

router.post('/projects', fetchuser, projectController.create);
router.get('/projects', fetchuser, projectController.list);
router.get('/projects/:id', fetchuser, checkMembership, projectController.getById);
router.put('/projects/:id', fetchuser, checkMembership, projectController.update);
router.delete('/projects/:id', fetchuser, projectController.remove);
router.delete('/projects/:id/members/:memberId', fetchuser, projectController.removeMember);

module.exports = router;
