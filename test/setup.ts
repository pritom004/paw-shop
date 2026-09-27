import {unlink} from "fs/promises";
import {join} from "path";

global.beforeEach(async() => {

 await unlink(join(__dirname, "..", "test.sqlite"))

})