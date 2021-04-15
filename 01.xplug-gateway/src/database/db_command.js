const EventEmitter = require('events');
const util = require('util');
const dbSql = require('./db_sql');

const DEBUG = false; 

let _this_command;

class DBCommandListener extends EventEmitter
{
    constructor() 
    {        
        super();

        _this_command = this;
        dbSql.open();    
        
        setInterval(() => {
            dbSql.getNewCommand().then((rows) => {
                DEBUG && console.info('Get New Command from DB');
                if( rows ) 
                {
                    for ( const cmd of rows) 
                    {
                        DEBUG && console.info('emit oncommand');
                        
                        dbSql.updateCommandPrcsStat(cmd.CMD_SQ, 1).then((resolt) => {
                            _this_command.emit("oncommand", cmd);
                        }).catch(function (reason) {
                            console.error( reason);
                        });                         
                    }
                }
            }).catch(function (reason) {
                console.error( reason);
            });
        }, 500);
    }
}

module.exports = new DBCommandListener();