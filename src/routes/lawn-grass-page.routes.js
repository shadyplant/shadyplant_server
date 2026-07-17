const express = require("express");
const { getLawnGrassPage } = require("../controllers/lawn-grass-page.controller");

const router = express.Router();

router.get("/", getLawnGrassPage);

module.exports = router;
