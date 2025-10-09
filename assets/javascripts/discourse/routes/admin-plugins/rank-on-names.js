import Route from "@ember/routing/route";
import { ajax } from "discourse/lib/ajax";

export default class AdminPluginsRankOnNamesRoute extends Route {
  model() {
    return ajax("/admin/plugins/rank-on-names/prefixes.json");
  }

  setupController(controller, model) {
    super.setupController(controller, model);
    controller.setInitialModel(model.prefixes);
  }
}
