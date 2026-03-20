// backend/store/usersStore.js
const users = [];

module.exports = {
  users,
  addUser(user) {
    users.push(user);
    return user;
  },
  findUserByEmail(email) {
    return users.find(u => u.email === email);
  },
  findUserById(id) {
    return users.find(u => u.id === id);
  },
  getAllUsers() {
    return users.map(({ passwordHash, ...rest }) => rest);
  },
  updateUserRole(id, role) {
    const user = users.find(u => u.id === id);
    if (user) {
      user.role = role;
      return { ...user, passwordHash: undefined };
    }
    return null;
  }
};