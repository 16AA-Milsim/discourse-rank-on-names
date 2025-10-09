export default {
  resource: "admin.adminPlugins",
  path: "/plugins",
  map() {
    this.route("rankOnNames", { path: "/rank-on-names" });
  },
};
