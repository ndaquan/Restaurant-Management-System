const express = require("express");
const router = express.Router();
const upload = require("../config/multer/index");
const newsController = require("../app/controllers/EditNewsController");
const isAuth = require("../app/middlewares/is-auth");
const isPermissions = require("../app/middlewares/isPermissions");

router.get(
  "/",
  isAuth.requireAuth,
  isPermissions(["RESOWNER"]),
  newsController.getList
);
router.get(
  "/detail/:id",
  isAuth.requireAuth,
  isPermissions(["RESOWNER"]),
  newsController.renderDetailNews
);
router.delete(
  "/:id",
  isAuth.requireAuth,
  isPermissions(["RESOWNER"]),
  newsController.deleteNews
);
router.get(
  "/add",
  isAuth.requireAuth,
  isPermissions(["RESOWNER"]),
  newsController.renderCreateForm
);
router.get(
  "/edit/:id",
  isAuth.requireAuth,
  isPermissions(["RESOWNER"]),
  newsController.renderEditForm
);
router.put(
  "/:id",
  isAuth.requireAuth,
  isPermissions(["RESOWNER"]),
  upload.single("image"),
  newsController.updateNews
);
router.post(
  "/",
  isAuth.requireAuth,
  isPermissions(["RESOWNER"]),
  upload.single("image"),
  newsController.createNews
);
router.delete(
  "/",
  isAuth.requireAuth,
  isPermissions(["RESOWNER"]),
  newsController.deleteNews
);
router.put(
  "/",
  isAuth.requireAuth,
  isPermissions(["RESOWNER"]),
  newsController.updateNews
);
router.get(
  "/search",
  isAuth.requireAuth,
  isPermissions(["RESOWNER"]),
  newsController.searchNews
);

module.exports = router;
