#!/usr/bin/env bun

import "dotenv/config";
import { CliApplication } from "./CliApplication.js";

const application = new CliApplication();

void application.run(process.argv);
