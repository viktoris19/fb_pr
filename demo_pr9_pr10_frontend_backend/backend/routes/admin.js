const express = require("express");
const { authMiddleware, requireRole } = require("../middleware/authJwt");
const userStore = require("../store/usersStore");

const router = express.Router();

router.use(authMiddleware);
router.use(requireRole("admin"));

router.get("/users", (req, res) => {
  res.json(userStore.getAllUsers());
});

router.patch("/users/:id/role", (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  
  if (!role || (role !== "admin" && role !== "user")) {
    return res.status(400).json({
      error: "validation_error",
      message: "Роль должна быть 'admin' или 'user'",
    });
  }
  
  const updatedUser = userStore.updateUserRole(id, role);
  if (!updatedUser) {
    return res.status(404).json({
      error: "user_not_found",
      message: "Пользователь не найден",
    });
  }
  
  res.json(updatedUser);
});

module.exports = router;