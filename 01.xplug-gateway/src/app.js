'use strict';

require('./utils/logger');
console.silly  ('Check Log Level : silly'); // { error: 0, warn: 1, info: 2, verbose: 3, debug: 4, silly: 5 }
console.debug  ('Check Log Level : debug');
console.verbose('Check Log Level : verbose');
console.info   ('Check Log Level : info');
console.warn   ('Check Log Level : warn');
console.error  ('Check Log Level : error');

console.info(`>>>>>>>>>>>> Start xPlug Application <<<<<<<<<<<<`);


const   C_AREA          = require('./common_area');
var     config          = require("config");



C_AREA.dbSql            = require('./database/db_sql');  
C_AREA.dbSql.open();

C_AREA.dbCmdListener    = require('./database/db_command');

var adtService          = require("./adapter");
var webController       = require("./web");


require("./cloud");           //  클라우드 연계 

require("./iptime");          // 공유기 플러그 

