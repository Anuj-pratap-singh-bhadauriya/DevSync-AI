const express = require('express');
const router = express.Router();
const fetchuser = require('../middleware/fetchuser');
const miscController = require('../controllers/misc.controller');

router.get('/ping', miscController.ping);
router.get('/turn-credentials', fetchuser, miscController.turnCredentials);

module.exports = router;
