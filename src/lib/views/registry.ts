import "server-only";

import type { ViewMap } from "./types";
import { views as me } from "./me";
import { views as holiday } from "./holiday";
import { views as tasks } from "./tasks";
import { views as actions } from "./actions";
import { views as maintenance } from "./maintenance";
import { views as sops } from "./sops";
import { views as events } from "./events";
import { views as stocktake } from "./stocktake";
import { views as socialPhotos } from "./social-photos";
import { views as checkins } from "./checkins";
import { views as myDetails } from "./my-details";
import { views as admin } from "./admin";
import { views as adminPeople } from "./admin-people";
import { views as adminSettings } from "./admin-settings";

// Every module's loaders, by the name the browser asks for them under
// (/api/view/<module>/<name>). Each module's file is its own — add loaders
// there, not here.
export const VIEW_MODULES: Record<string, ViewMap> = {
  me,
  holiday,
  tasks,
  actions,
  maintenance,
  sops,
  events,
  stocktake,
  "social-photos": socialPhotos,
  checkins,
  "my-details": myDetails,
  admin,
  "admin-people": adminPeople,
  "admin-settings": adminSettings,
};
