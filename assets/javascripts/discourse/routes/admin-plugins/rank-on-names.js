import DiscourseRoute from "discourse/routes/discourse";
import { ajax } from "discourse/lib/ajax";

export default class AdminPluginsRankOnNamesRoute extends DiscourseRoute {
  model() {
    if (!this.currentUser?.admin || !this.siteSettings.rank_on_names_enabled) {
      return { prefixes: [], drop_zone_flashes: [], disabled: true };
    }

    return ajax("/admin/plugins/rank-on-names/prefixes.json");
  }

  setupController(controller, model) {
    super.setupController(controller, model);
    controller.setInitialModel(model || {});
  }
}
