const express = require("express");
const { listHomeCategoryItems } = require("../controllers/home-category.controller");

const router = express.Router();

router.get("/", listHomeCategoryItems);

module.exports = router;
