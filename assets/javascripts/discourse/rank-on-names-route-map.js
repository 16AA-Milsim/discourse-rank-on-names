export default {
  resource: "admin.adminPlugins",
  path: "/plugins",
  map() {
    this.route("rank-on-names", { path: "/rank-on-names" });
  },
};
