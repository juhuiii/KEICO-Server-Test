'use strict';

const   EventEmitter    = require('events');

const config = require('config');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const xpUtils = require("../utils/xg_datetime");



class Database extends EventEmitter {


    constructor() {
        super();
    }

  /**
   * Open the database.
   */
  open () {

    if (this.db)  return;


    let filename = config.get('database.file');
    let exists = false;

    exists = fs.existsSync(filename);

    console.info( "[Database]", exists ? 'Opening' : 'Creating', 'database:', filename );

    this.db = new sqlite3.Database(filename);

    this.db.configure('busyTimeout', 10000);

    this.db.serialize(() => {
      this.createTables();
      if (!exists) {
        this.populate();
      }
    });

    //변경된 스키마 체크 1 ( SND_ST 컬럼 여부 확인후 컬럼 자동 추가  )
    this.db.serialize( () => {

        let arrCols = ['TR_DAY', 'TR_HOUR', 'TR_SW_EVNT', 'TR_CTRL'];   //SND_ST 컬럼이 있어야 할 테이블 목록

        arrCols.forEach( tableName =>{

            this.checkSndStColumn( tableName ).then( (rows) => {

                let is_column    = rows[0]["SND_ST_YN"];
                if( is_column != 1 )  {
                    this.makeColumnSndSt( tableName ) ;
                    console.info(`ADD COLUMN SND_ST ON TABLE '${tableName}'`);
                }

            }).catch(function (reason) {
                console.error( reason );
            });
        });
    });
  }


  createTables()
  {
    this.db.run('CREATE TABLE IF NOT EXISTS TB_SITE ( ' +
        ' STE_SQ               INTEGER PRIMARY KEY AUTOINCREMENT,' +
        ' STE_NM               TEXT NULL,' +
        ' CLOUD_ID             TEXT NULL,' +
        ' GATEWAY_ID           TEXT NULL,' +
        ' INS_DT               INTEGER NULL,' +
        ' MNGR_PW              TEXT NULL,' +
        ' OPER_PW              TEXT NULL,' +
        ' REG_DTIME            TEXT NULL,' +
        ' EDT_DTIME            TEXT NULL,' +
        ' WORK_STM             INTEGER NULL,' +
        ' WORK_ETM             INTEGER NULL) '
    );

    this.db.run('CREATE TABLE IF NOT EXISTS TZB_COMMAND ( ' +
        ' CMD_SQ               INTEGER PRIMARY KEY AUTOINCREMENT, ' +
        ' CMD_TYPE             INTEGER DEFAULT 0, ' +
        ' CMD_DT               INTEGER NULL, ' +
        ' CMD_TM               INTEGER NULL, ' +
        ' CMD_CD               TEXT NULL, ' +
        ' CMD_PARAM            TEXT NULL, ' +
        ' SND_DT               INTEGER NULL, ' +
        ' SND_TM               INTEGER NULL, ' +
        ' SND_ST               INTEGER NULL, ' +
        ' RCV_DT               INTEGER NULL, ' +
        ' RCV_TM               INTEGER NULL,  ' +
        ' RCV_ST               INTEGER NULL, ' +
        ' RSV_DT               INTEGER NULL,  ' +
        ' RSV_TM               INTEGER NULL, ' +
        ' ZDO_SQ               INTEGER NULL, ' +
        ' PRCS_ST              INTEGER NULL, ' +
        ' RST_CD               INTEGER NULL, ' +
        ' RST_MSG              TEXT NULL ) '
    );

    this.db.run(`CREATE TABLE IF NOT EXISTS TB_DEV (
        ZB_ADDR              TEXT PRIMARY KEY ,
        DEV_NM               TEXT NULL,
        DEV_GB               INTEGER NULL,
        DEV_ST               INTEGER NULL,
        SW_ST                INTEGER NULL,
        KW                   REAL DEFAULT 0,
        AKWH                 REAL NULL,
        STBY_KW              REAL DEFAULT 0,
        OFF_DELY             INTEGER DEFAULT 0,
        MANU_CTL_ALLOW       INTEGER DEFAULT 1,
        RCV_DT               INTEGER NULL,
        RCV_TM               INTEGER NULL,
        BIGO                 TEXT NULL,
        GRP_SQ               INTEGER NULL,
        CHG_DT               INTEGER NULL,
        CHG_TM               INTEGER NULL,
        CHG_KW               REAL NULL,
        ZB_RGRP_AID          INTEGER DEFAULT 0,
        ZB_ONGRP_AID         INTEGER DEFAULT 0,
        ZB_OFFGRP_AID        INTEGER DEFAULT 0,
        ZB_RGRP_RID          INTEGER DEFAULT 0,
        ZB_ONGRP_RID         INTEGER DEFAULT 0,
        ZB_OFFGRP_RID        INTEGER DEFAULT 0,
        EDT_DTIME            TEXT NULL,
        REG_DTIME            TEXT NULL )`);

    this.db.run(`CREATE TABLE IF NOT EXISTS TB_GROUP (
        GRP_SQ               INTEGER PRIMARY KEY AUTOINCREMENT,
        GRP_NM               TEXT NULL,
        BIGO                 TEXT NULL,
        REG_DTIME            TEXT NULL,
        EDT_DTIME            TEXT NULL ) `);

    this.db.run(`CREATE TABLE IF NOT EXISTS TB_HOLIDAY(
        HOLI_DT              INTEGER PRIMARY KEY ,
        HOLI_NM              TEXT NULL,
        REG_DTIME            TEXT NULL,
        EDT_DTIME            TEXT NULL ) `);


    this.db.run(`CREATE TABLE IF NOT EXISTS  TB_SCHD (
        SCHD_SQ              INTEGER PRIMARY KEY AUTOINCREMENT,
        SCHD_NM              TEXT NULL,
        GRP_SQ               INTEGER NOT NULL,
        WEEK_BIT             TEXT NULL,
        HOLI_YN              INTEGER NULL,
        BIGO                 TEXT NULL,
        REG_DTIME            TEXT NULL,
        EDT_DTIME            TEXT NULL ) `);

    this.db.run(`CREATE TABLE IF NOT EXISTS TB_SCHD_TM (
        SCHD_TM_SQ           INTEGER PRIMARY KEY AUTOINCREMENT,
        SCHD_SQ              INTEGER NOT NULL,
        CTL_TIME             INTEGER NULL,
        CTL_CMD              INTEGER NULL,
        LAST_RUN_DT          INTEGER NULL,
        REG_DTIME            TEXT NULL,
        EDT_DTIME            TEXT NULL ) `);

    this.db.run(`CREATE TABLE IF NOT EXISTS TR_CTRL (
        CTL_SQ               INTEGER PRIMARY KEY AUTOINCREMENT,
        CTL_DT               INTEGER NULL,
        CTL_TM               INTEGER NULL,
        ZB_ADDR              TEXT NULL,
        GRP_SQ               INTEGER NULL,
        CTL_TYPE             INTEGER NULL,
        CTL_OBJ              INTEGER NULL,
        CTL_CMD              INTEGER NULL,
        SCHD_TM_SQ           INTEGER NULL,
        SCHD_SQ              INTEGER NULL ,
        KW                    REAL,
        SND_ST               INTEGER NULL ) `);

    this.db.run(`CREATE TABLE IF NOT EXISTS TR_DAY(
        ZB_ADDR              TEXT NOT NULL,
        TX_DT                INTEGER NOT NULL,
        S_AKWH               REAL NULL,
        E_AKWH               REAL NULL,
        SAVE_KW              REAL NULL,
        SAVE_SEC             INTEGER NULL,
        SND_ST               INTEGER NULL,
        REG_DTIME            TEXT NULL,
        EDT_DTIME            TEXT NULL ) `);

    this.db.run(`CREATE TABLE IF NOT EXISTS TR_HOUR (
        ZB_ADDR              TEXT NOT NULL,
        TX_DT                INTEGER NOT NULL,
        TX_TM                INTEGER NOT NULL,
        S_AKWH               REAL NULL,
        E_AKWH               REAL NULL,
        SND_ST               INTEGER NULL,
        REG_DTIME            TEXT NULL,
        EDT_DTIME            TEXT NULL) `);

    this.db.run(`CREATE TABLE  IF NOT EXISTS TR_SW_EVNT (
        ZB_ADDR              TEXT NOT NULL,
        TX_DT                INTEGER NOT NULL,
        TX_TM                INTEGER NOT NULL,
        SW_ST                INTEGER NULL ,
        SAVE_KW	             REAL NULL,
        SAVE_SEC             INTEGER NULL,
        SND_ST               INTEGER NULL ) `);


    this.db.run(`CREATE TABLE IF NOT EXISTS TR_SYSLOG (
        LOG_SQ               INTEGER PRIMARY KEY AUTOINCREMENT,
        LOG_DT               INTEGER NULL,
        LOG_TM               INTEGER NULL,
        LOG_CD               TEXT NULL,
        LOG_MSG              TEXT NULL ) `);
  }

  /**
   * Insert Default Data Values
   */
  populate() {

    console.info('Populating database with default values...');

    const defaultSiteName = config.get('default.siteName');
    const defaultManagerPassword = config.get('default.managerPassword');
    const defaultOperatorPassword = config.get('default.operatorPassword');

    const yyyymmdd = xpUtils.getCurDate();
    const yyyymmddHHMMss = xpUtils.getCurDateTime();

    this.db.run(
        'INSERT INTO TB_SITE (STE_NM, INS_DT, MNGR_PW, OPER_PW, REG_DTIME, EDT_DTIME ) VALUES (?, ?, ?, ?, ?, ?) ',
        [defaultSiteName, yyyymmdd, defaultManagerPassword,  defaultOperatorPassword, yyyymmddHHMMss, yyyymmddHHMMss],
        function(error) {
            if (error) {
                console.error('Failed to save default TB_SITE.');
            } else {
                console.info(`Saved default TB_SITE ${defaultSiteName}`);
            }
        }
    );
  }


    // SND_ST 컬럼 유무 체크
    checkSndStColumn( tblName ) {
        const sql = `SELECT EXISTS (SELECT * FROM SQLITE_MASTER WHERE TBL_NAME = '${tblName}'  AND SQL LIKE '%SND_ST%') AS SND_ST_YN `;
        return this.doSelect(sql);
    }

    // SND_ST 컬럼 추가
    makeColumnSndSt( tblName )
    {
      try {
        this.db.run(` ALTER TABLE ${tblName} ADD SND_ST INTEGER  `);
      }catch(e){
      }
    }


    //TZB_COMMAND
    selectCommands (offset) {
        const sql =  `SELECT CMD_SQ, CMD_TYPE,  CMD_DT, CMD_TM, CMD_CD, CMD_PARAM, RSV_DT, RSV_TM, SND_ST, PRCS_ST FROM TZB_COMMAND  ORDER BY CMD_DT DESC, CMD_TM DESC LIMIT 10 OFFSET ${offset}`;
        return this.doSelect(sql);
    }

    getNewCommand() {
         const sql =   " SELECT CMD_SQ, CMD_TYPE, CMD_DT, CMD_TM, CMD_CD, CMD_PARAM, RSV_DT, RSV_TM, SND_ST, PRCS_ST FROM TZB_COMMAND " +
                       " WHERE SND_ST = 0 AND PRCS_ST = 0 AND " +
                       "  ( " +
                       "      ( CMD_TYPE = 0  AND  ( (CMD_DT * 1000000) + CMD_TM > CAST( STRFTIME('%Y%m%d%H%M%S','now', 'localtime', '-30 second' ) AS INTEGER )) )" + //즉시전송
                       "       OR  "      +
                       "      ( CMD_TYPE = 1  AND  RSV_DT = CAST( STRFTIME('%Y%m%d','now', 'localtime') AS INTEGER )  AND  ( RSV_TM <= CAST( STRFTIME('%H%M%S','now', 'localtime') AS INTEGER )) )" + //예약전송
                       "  ) LIMIT 1";
        return this.doSelect(sql);
    }

    updateCommandPrcsStat(CMD_SQ, PRC_ST) {
        let  curDate = xpUtils.getCurDate() ;
        let  curTIme = xpUtils.getCurTime();

        //SND_ST :송신상태(0:송신대기중,1:송신완료,2::송신실패)
        //PRCS_ST:명령처리상태(0:대기중, 1:처리중, 2:완료성공, 3:실패완료)
        const sql  =  "UPDATE TZB_COMMAND SET PRCS_ST=? WHERE CMD_SQ=?";
        const val =  [PRC_ST, CMD_SQ ];

        return this.doUpdate(sql, val);
    }

    updateCommandSend(dbCmd) {
        let  curDate = xpUtils.getCurDate() ;
        let  curTime = xpUtils.getCurTime();

        //SND_ST :송신상태(0:송신대기중,1:송신완료,2::송신실패)
        //PRCS_ST:명령처리상태(0:대기중, 1:처리중, 2:완료성공, 3:실패완료)
        const sql  =  "UPDATE TZB_COMMAND SET SND_DT=?, SND_TM=?, SND_ST=?, PRCS_ST=? WHERE CMD_SQ=?";
        const val  =  [curDate, curTime, dbCmd.SND_ST, dbCmd.PRCS_ST, dbCmd.CMD_SQ]
        return this.doUpdate(sql, val);
    }

    updateCommandRecvAck(msg) {
        let  rcv_dt = xpUtils.getCurDate() ;
        let  rcv_tm = xpUtils.getCurTime();

        let rcv_st  = 1;        //RCV_ST : 응답상태(0:응답대기, 1:ACK응답수신완료, 2: Data응답수신완료, 3:응답수신실패)
        let prcs_st = 1;        //PRCS_ST : 명령처리상태(0:대기중, 1:처리중, 2:완료성공, 3:실패완료)
        if( msg.cmd === "SC" ||
            msg.cmd === "JOIN_START"  ||
            msg.cmd === "JOIN_STOP"   ||
            msg.cmd === "ON" || msg.cmd === "OFF" ||
            msg.cmd === "DEV_DEL"  )
            prcs_st = 2;      //Send Ack만 받으면 절차가 끝나는 Commands


        const sql  =  "UPDATE TZB_COMMAND SET RCV_DT=?, RCV_TM=?, RCV_ST=?, ZDO_SQ=?, PRCS_ST=? WHERE CMD_SQ=?";
        const val =  [rcv_dt, rcv_tm, rcv_st, msg.zdoSeq, prcs_st, msg.tno]
        return this.doUpdate(sql, val);
    }

    updateCommandRecvData(msg) {

        if(  msg.cmd !== "CH" )         //요청 => 요청ACK => 데이터 응답하는  Command
            return ;

        if( !msg.zdoSeq ) return ;      //Data응답은  zdoSeq 필수

        let  rcv_dt = xpUtils.getCurDate() ;
        let  rcv_tm = xpUtils.getCurTime();

        let zdo_sq  = msg.zdoSeq;
        let rcv_st  = 2;        //RCV_ST  : 응답상태(0:응답대기, 1:ACK응답수신완료, 2: Data응답수신완료, 3:응답수신실패)
        let prcs_st = 2;        //PRCS_ST : 명령처리상태(0:대기중, 1:처리중, 2:완료성공, 3:실패완료)
        let rst_cd   = msg.rst;
        let rst_msg  = msg.data  + " : "  + msg.rms;

        const sql =  `UPDATE TZB_COMMAND SET RCV_DT=?, RCV_TM=?, RCV_ST=?, PRCS_ST=?, RST_CD=?, RST_MSG=? WHERE ZDO_SQ=? AND (CMD_DT * 1000000) + CMD_TM > CAST( STRFTIME('%Y%m%d%H%M%S','now', 'localtime', '-60 second' ) AS INTEGER ) `;
        const val =  [rcv_dt, rcv_tm, rcv_st, prcs_st, rst_cd, rst_msg, zdo_sq]
        return this.doUpdate(sql, val);
    }



    async insertCommand ( CMD_CD, CMD_PARAM ) {
        let  curDateTime = xpUtils.getCurDateTime() ;
        let cmd = {};
        cmd["CMD_CD"]   = CMD_CD;
        cmd["CMD_PARAM"]= CMD_PARAM;

        cmd["CMD_DT"]= xpUtils.getCurDate();
        cmd["CMD_TM"]= xpUtils.getCurTime();

        let sql = 'INSERT INTO TZB_COMMAND ( CMD_TYPE, CMD_DT, CMD_TM, CMD_CD, CMD_PARAM, SND_ST, PRCS_ST ) VALUES ( ?, ?, ?, ?, ?, ?, ?)';
        let val = [ 0, cmd.CMD_DT, cmd.CMD_TM, cmd.CMD_CD, cmd.CMD_PARAM, 0, 0];
        return this.doUpdate(sql, val);
    }

    async insertCommandReserv ( CMD_CD, CMD_PARAM, RSV_DT, RSV_TM ) {
        let  curDateTime = xpUtils.getCurDateTime() ;
        let cmd = {};
        cmd["CMD_CD"]   = CMD_CD;
        cmd["CMD_PARAM"]= CMD_PARAM;

        cmd["CMD_DT"]= xpUtils.getCurDate();
        cmd["CMD_TM"]= xpUtils.getCurTime();

        let sql = 'INSERT INTO TZB_COMMAND ( CMD_TYPE, CMD_DT, CMD_TM, CMD_CD, CMD_PARAM, RSV_DT, RSV_TM,  SND_ST, PRCS_ST ) VALUES ( ?, ?, ?, ?, ?, ?, ?, ?, ? )';
        let val = [ 1, cmd.CMD_DT, cmd.CMD_TM, cmd.CMD_CD, cmd.CMD_PARAM, RSV_DT, RSV_TM, 0, 0];
        return this.doUpdate(sql, val);
    }


    //TB_SITE
    selectSite () {
        const sql = 'SELECT STE_SQ, STE_NM, CLOUD_ID, GATEWAY_ID, INS_DT, MNGR_PW, OPER_PW, REG_DTIME, EDT_DTIME, WORK_STM, WORK_ETM FROM TB_SITE';
        return this.doSelect(sql);
    }

    async updateSite(objData, STE_SQ) {
        let  curDateTime = xpUtils.getCurDateTime() ;
        objData['EDT_DTIME'] = curDateTime;

        let where = { STE_SQ : STE_SQ };

        let promise = this.doUpdateCommon('TB_SITE', objData,  where);
        let keys = {
            STE_SQ
        };

        promise.then( (result) => {
            this.dbEventEmit('TB_SITE', 'UPDATE', keys);
        } );

        return promise;
    }

    async updateSitePassword ( siteSq, managerPassword, operatorPassword ) {
        let  curDateTime = xpUtils.getCurDateTime() ;
        let sql = 'UPDATE TB_SITE SET MNGR_PW=?, OPER_PW=?, EDT_DTIME=?  WHERE STE_SQ=?';
        let val = [managerPassword, operatorPassword, yyyymmddHHMMss, siteSq ]

        let promise = this.doUpdate(sql, val);

        let keys = {
            STE_SQ : siteSq
        };

        promise.then( (result) => {
            this.dbEventEmit('TB_SITE', 'UPDATE', keys );
        } );

        return promise;
    }

    //TB_DEV
    selectDevicesOrderByAddr() {
        let sql = 'SELECT ZB_ADDR, DEV_NM, DEV_GB, DEV_ST, SW_ST, KW, AKWH, STBY_KW, OFF_DELY, MANU_CTL_ALLOW, CHG_DT, CHG_TM, CHG_KW, RCV_DT, RCV_TM, BIGO, GRP_SQ, EDT_DTIME, REG_DTIME , ZB_ONGRP_AID, ZB_OFFGRP_AID, ZB_RGRP_AID,  ZB_ONGRP_RID, ZB_OFFGRP_RID, ZB_RGRP_RID FROM TB_DEV ORDER BY ZB_ADDR';

        return this.doSelect(sql);
    }

    selectDevices() {
        let sql = 'SELECT ZB_ADDR, DEV_NM, DEV_GB, DEV_ST, SW_ST, KW, AKWH, STBY_KW, OFF_DELY, MANU_CTL_ALLOW, CHG_DT, CHG_TM, CHG_KW, RCV_DT, RCV_TM, BIGO, GRP_SQ, EDT_DTIME, REG_DTIME , ZB_ONGRP_AID, ZB_OFFGRP_AID, ZB_RGRP_AID,  ZB_ONGRP_RID, ZB_OFFGRP_RID, ZB_RGRP_RID FROM TB_DEV ORDER BY DEV_NM';

        return this.doSelect(sql);
    }

    selectDevicesByGroup(GRP_SQ) {
        let sql = `SELECT ZB_ADDR, DEV_NM, DEV_GB, DEV_ST, SW_ST, KW, AKWH, STBY_KW, OFF_DELY,  MANU_CTL_ALLOW, CHG_DT, CHG_TM, CHG_KW, RCV_DT, RCV_TM, BIGO, GRP_SQ, EDT_DTIME, REG_DTIME, ZB_ONGRP_AID, ZB_OFFGRP_AID, ZB_RGRP_AID,  ZB_ONGRP_RID, ZB_OFFGRP_RID, ZB_RGRP_RID  FROM TB_DEV WHERE GRP_SQ = ${GRP_SQ} ORDER BY DEV_NM`;
        return this.doSelect(sql);
    }

    selectDevice(zb_addr) {
        let sql = `SELECT ZB_ADDR, DEV_NM, DEV_GB, DEV_ST, SW_ST, KW, AKWH, STBY_KW, OFF_DELY,  MANU_CTL_ALLOW, CHG_DT, CHG_TM, CHG_KW, RCV_DT, RCV_TM, BIGO, GRP_SQ, EDT_DTIME, REG_DTIME, ZB_ONGRP_AID, ZB_OFFGRP_AID, ZB_RGRP_AID,  ZB_ONGRP_RID, ZB_OFFGRP_RID, ZB_RGRP_RID FROM TB_DEV WHERE ZB_ADDR = '${zb_addr}'`;
        return this.doSelect(sql);
    }

    //공유기장치에 연결된 플러그
    selectDeviceIPTime() {
        let sql = `SELECT ZB_ADDR, DEV_NM, DEV_GB, DEV_ST, SW_ST, KW, AKWH, STBY_KW, OFF_DELY,  MANU_CTL_ALLOW, CHG_DT, CHG_TM, CHG_KW, RCV_DT, RCV_TM, BIGO, GRP_SQ, EDT_DTIME, REG_DTIME, ZB_ONGRP_AID, ZB_OFFGRP_AID, ZB_RGRP_AID,  ZB_ONGRP_RID, ZB_OFFGRP_RID, ZB_RGRP_RID FROM TB_DEV WHERE DEV_NM LIKE '%.%.%.%'`;
        return this.doSelect(sql);
    }

    async insertDevice( dev ) {
        let  curDateTime = xpUtils.getCurDateTime() ;
        dev.REG_DTIME = curDateTime;
        dev.EDT_DTIME = curDateTime;

        let sql = 'INSERT INTO TB_DEV( ZB_ADDR, DEV_NM, DEV_GB, DEV_ST, SW_ST, KW, AKWH, STBY_KW, OFF_DELY,  MANU_CTL_ALLOW, CHG_DT, CHG_TM, CHG_KW, RCV_DT, RCV_TM, BIGO, GRP_SQ, EDT_DTIME, REG_DTIME) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
        let val = [ dev.ZB_ADDR, dev.DEV_NM, dev.DEV_GB, dev.DEV_ST, dev.SW_ST, dev.KW, dev.AKWH, dev.STBY_KW, dev.OFF_DELY, dev.MANU_CTL_ALLOW, dev.CHG_DT, dev.CHG_TM, dev.CHG_KW, dev.RCV_DT, dev.RCV_TM, dev.BIGO, dev.GRP_SQ, dev.EDT_DTIME, dev.REG_DTIME ];

        let promise = this.doUpdate(sql, val);

        let keys = {
            ZB_ADDR : dev.ZB_ADDR
        };

        promise.then( (result) => {
            this.dbEventEmit('TB_DEV', 'INSERT', keys);
        } );


        return promise;
    }

    async updateDevice (objData, ZB_ADDR) {

        objData['EDT_DTIME'] = xpUtils.getCurDateTime();
        let where = { ZB_ADDR : ZB_ADDR };

        let promise = this.doUpdateCommon('TB_DEV', objData,  where);

        let keys = {
            ZB_ADDR : ZB_ADDR
        };

        promise.then( (result) => {
            this.dbEventEmit('TB_DEV', 'UPDATE', keys);
        } );

        return promise;
    }

    async updateDeviceMeas( zb_addr, colname, colval ) {
        let  curDateTime = xpUtils.getCurDateTime() ;
        let  rcv_dt      = xpUtils.getCurDate() ;
        let  rcv_tm      = xpUtils.getCurTime();

        let sql = `UPDATE TB_DEV SET ${colname}=?, DEV_ST=1, RCV_DT=?, RCV_TM=?, EDT_DTIME=? WHERE ZB_ADDR =?` ;
        let val = [ colval, rcv_dt, rcv_tm ,curDateTime, zb_addr ];

        let promise = this.doUpdate(sql, val);

        let keys = {
            ZB_ADDR : zb_addr
        };

        promise.then( (result) => {
            this.dbEventEmit('TB_DEV', 'UPDATE', keys);
        } );

        return promise;
    }

    async updateDeviceSwStatChange( zb_addr, SW_ST, CHG_DT, CHG_TM, CHG_KW, BIGO ) {
        let  curDateTime = xpUtils.getCurDateTime() ;
        let  rcv_dt      = xpUtils.getCurDate() ;
        let  rcv_tm      = xpUtils.getCurTime();

        let sql = `UPDATE TB_DEV SET SW_ST=?, CHG_DT=?, CHG_TM=?, CHG_KW=?,  DEV_ST=1, RCV_DT=?, RCV_TM=?, EDT_DTIME=?, BIGO=? WHERE ZB_ADDR =?` ;
        let val = [ SW_ST, CHG_DT, CHG_TM, CHG_KW, rcv_dt, rcv_tm ,curDateTime, BIGO, zb_addr ];

        let promise = this.doUpdate(sql, val);

        let keys = {
            ZB_ADDR : zb_addr
        };

        promise.then( (result) => {
            this.dbEventEmit('TB_DEV', 'UPDATE', keys);
        } );

        return promise;
    }

    async updateDeviceComError() {
        let uSql = `UPDATE TB_DEV SET DEV_ST = 2, KW=0, EDT_DTIME=${xpUtils.getCurDateTime()}  WHERE DEV_ST <> 2 AND ((RCV_DT * 1000000) + RCV_TM) < CAST( STRFTIME('%Y%m%d%H%M%S','now', 'localtime', '-5400 second' ) AS INTEGER )`;

        // this.dbEventEmit('TB_DEV', 'UPDATE');
        // 클라우드는 서버에서 통신이상 자체 처리 하도록 함.

        return this.doUpdate(uSql);
    }

    async deleteDevice( zb_addr ) {
        let sql = `DELETE FROM TB_DEV WHERE ZB_ADDR='${zb_addr}'`;

        let promise = this.run(sql);

        let keys = {
            ZB_ADDR : zb_addr
        };

        promise.then( (result) => {
            this.dbEventEmit('TB_DEV', 'DELETE', keys);
        } );

        return promise;
    }

    async updateDeviceGroupNull(grp_sq) {

        let uSql = `UPDATE TB_DEV SET GRP_SQ = null WHERE GRP_SQ = ${grp_sq}`;

        let promise = this.doUpdate(uSql);

        promise.then( (result) => {
            this.dbEventEmit('TB_DEV', 'UPDATE');
        } );

        return promise;
    }



    selectDeviceForNextGroupAssign( COL_NAME ){         //Select For Getting Next Assign Group id
        let sql = ` SELECT ${COL_NAME}, COUNT(*) CNT
                    FROM TB_DEV
                    WHERE ${COL_NAME} != 0
                    GROUP BY ${COL_NAME}
                    ORDER BY CNT ASC, ${COL_NAME} DESC
                    LIMIT 1`;
                    //COL_NAME : ZB_ONGRP_AID or ZB_OFFGRP_AID or  ZB_RGRP_AID
        return this.doSelect(sql);
    }

    selectDevicesForOnGroupAssgin() { //ON Group Assing ID 할당 대상
        let sql = ` SELECT ZB_ADDR, DEV_NM, DEV_GB, STBY_KW, OFF_DELY, MANU_CTL_ALLOW,  GRP_SQ, ZB_ONGRP_AID, ZB_OFFGRP_AID, ZB_RGRP_AID
                    FROM TB_DEV
                    WHERE ZB_ONGRP_AID = 0 AND MANU_CTL_ALLOW = 1`;
        return this.doSelect(sql);
    }

    selectDevicesForOffGroupAssgin() { //OFF Group Assing ID 할당 대상
        let sql = ` SELECT ZB_ADDR, DEV_NM, DEV_GB, STBY_KW, OFF_DELY, MANU_CTL_ALLOW,  GRP_SQ, ZB_ONGRP_AID, ZB_OFFGRP_AID, ZB_RGRP_AID
                    FROM TB_DEV
                    WHERE  ZB_OFFGRP_AID = 0
                        AND ( OFF_DELY IS NULL OR OFF_DELY <= 0 )
                        AND MANU_CTL_ALLOW = 1`;

        return this.doSelect(sql);
    }
    selectDevicesForReadGroupAssgin() { //Read Group Assing ID 할당 대상
        let sql = ` SELECT ZB_ADDR, DEV_NM, DEV_GB, STBY_KW, OFF_DELY, MANU_CTL_ALLOW,  GRP_SQ, ZB_ONGRP_AID, ZB_OFFGRP_AID, ZB_RGRP_AID
                    FROM TB_DEV
                    WHERE ZB_RGRP_AID = 0`;
        return this.doSelect(sql);
    }
    updateOnGroupAssign(zb_addr, zb_ongrp_aid){
        let  curDateTime = xpUtils.getCurDateTime() ;
        let sql = `UPDATE TB_DEV SET ZB_ONGRP_AID=?, EDT_DTIME=? WHERE ZB_ADDR =?` ;
        let val = [ zb_ongrp_aid ,curDateTime, zb_addr ];

        let promise = this.doUpdate(sql, val);

        let keys = {
            ZB_ADDR : zb_addr
        };

        promise.then( (result) => {
            this.dbEventEmit('TB_DEV', 'UPDATE', keys);
        } );

        return promise;
    }
    updateOffGroupAssign(zb_addr, zb_offgrp_aid){
        let  curDateTime = xpUtils.getCurDateTime() ;
        let sql = `UPDATE TB_DEV SET ZB_OFFGRP_AID=?, EDT_DTIME=? WHERE ZB_ADDR =?` ;
        let val = [ zb_offgrp_aid ,curDateTime, zb_addr ];

        let promise = this.doUpdate(sql, val);

        let keys = {
            ZB_ADDR : zb_addr
        };

        promise.then( (result) => {
            this.dbEventEmit('TB_DEV', 'UPDATE', keys);
        } );

        return promise;
    }
    updateReadGroupAssign(zb_addr, zb_rgrp_aid){
        let  curDateTime = xpUtils.getCurDateTime() ;
        let sql = `UPDATE TB_DEV SET ZB_RGRP_AID=?, EDT_DTIME=? WHERE ZB_ADDR =?` ;
        let val = [ zb_rgrp_aid ,curDateTime, zb_addr ];

        let promise = this.doUpdate(sql, val);

        let keys = {
            ZB_ADDR : zb_addr
        };

        promise.then( (result) => {
            this.dbEventEmit('TB_DEV', 'UPDATE', keys);
        } );

        return promise;
    }
    //GROUP ID 동기해야할 목록
    selectDevicesForSyncZBGroup(AID_COL, RID_COL){
        let sql = ` SELECT ZB_ADDR, ZB_ONGRP_AID, ZB_OFFGRP_AID, ZB_RGRP_AID, ZB_ONGRP_RID, ZB_OFFGRP_RID, ZB_RGRP_RID
                    FROM TB_DEV
                    WHERE ${AID_COL} != ${RID_COL}`
                        // AND DEV_ST = 1`;
                    //AID_COL : ZB_ONGRP_AID or ZB_OFFGRP_AID or  ZB_RGRP_AID
                    //RID_COL : ZB_ONGRP_RID or ZB_OFFGRP_RID or  ZB_RGRP_RID
        return this.doSelect(sql);
    }
    updateOnGroupRegist(zb_addr, zb_ongrp_rid){
        let  curDateTime = xpUtils.getCurDateTime() ;
        let sql = `UPDATE TB_DEV SET ZB_ONGRP_RID=?, EDT_DTIME=? WHERE ZB_ADDR =?` ;
        let val = [ zb_ongrp_rid ,curDateTime, zb_addr ];

        let promise = this.doUpdate(sql, val);

        let keys = {
            ZB_ADDR : zb_addr
        };

        promise.then( (result) => {
            this.dbEventEmit('TB_DEV', 'UPDATE', keys);
        } );

        return promise;
    }
    updateOffGroupRegist(zb_addr, zb_offgrp_rid){
        let  curDateTime = xpUtils.getCurDateTime() ;
        let sql = `UPDATE TB_DEV SET ZB_OFFGRP_RID=?, EDT_DTIME=? WHERE ZB_ADDR =?` ;
        let val = [ zb_offgrp_rid ,curDateTime, zb_addr ];

        let promise = this.doUpdate(sql, val);

        let keys = {
            ZB_ADDR : zb_addr
        };

        promise.then( (result) => {
            this.dbEventEmit('TB_DEV', 'UPDATE', keys );
        } );

        return promise;
    }
    updateReadGroupRegist(zb_addr, zb_rgrp_rid){
        let  curDateTime = xpUtils.getCurDateTime() ;
        let sql = `UPDATE TB_DEV SET ZB_RGRP_RID=?, EDT_DTIME=? WHERE ZB_ADDR =?` ;
        let val = [ zb_rgrp_rid ,curDateTime, zb_addr ];

        let promise = this.doUpdate(sql, val);

        let keys = {
            ZB_ADDR : zb_addr
        };

        promise.then( (result) => {
            this.dbEventEmit('TB_DEV', 'UPDATE', keys);
        } );

        return promise;
    }
    updateZbGroupResetAll(){
        let sql = `UPDATE TB_DEV SET ZB_ONGRP_AID = 0, ZB_OFFGRP_AID= 0, ZB_RGRP_AID= 0, ZB_ONGRP_RID= 0, ZB_OFFGRP_RID= 0, ZB_RGRP_RID = 0 WHERE 1 = ?` ;
        let val = [ 1 ] ;

        let promise = this.doUpdate(sql, val);

        promise.then( (result) => {
            this.dbEventEmit('TB_DEV', 'UPDATE');
        } );

        return promise;
    }
    updateManuCtlAllowDisable(zb_addr){     //공유기 플러그 전체제어 거부 설정
        let  curDateTime = xpUtils.getCurDateTime() ;
        let sql = `UPDATE TB_DEV SET MANU_CTL_ALLOW=0, ZB_ONGRP_AID=0, ZB_OFFGRP_AID=0, EDT_DTIME=? WHERE ZB_ADDR = ?` ;

        let val = [ curDateTime, zb_addr ];

        let promise = this.doUpdate(sql, val);

        let keys = {
            ZB_ADDR : zb_addr
        };

        promise.then( (result) => {
            this.dbEventEmit('TB_DEV', 'UPDATE', keys );
        } );

        return promise;
    }



    selectZbReadGroup() { // Read     group 조회
        let sql = ` SELECT ZB_RGRP_RID FROM TB_DEV WHERE ZB_RGRP_RID != 0  GROUP BY ZB_RGRP_RID`;
        return this.doSelect(sql);
    }
    selectZbOnGroup() { // On  제어 group 조회
        let sql = ` SELECT ZB_ONGRP_RID FROM TB_DEV WHERE ZB_ONGRP_RID != 0 GROUP BY ZB_ONGRP_RID`;
        return this.doSelect(sql);
    }
    selectZbOnGroupDev() { // On  제어 group 조회
        let sql = ` SELECT ZB_ADDR, ZB_ONGRP_RID FROM TB_DEV WHERE ZB_ONGRP_RID != 0 `;
        return this.doSelect(sql);
    }
    selectZbOffGroup() { /// Off 제어 group 조회
        let sql = ` SELECT ZB_OFFGRP_RID FROM TB_DEV WHERE ZB_OFFGRP_RID != 0 GROUP BY ZB_OFFGRP_RID`;
        return this.doSelect(sql);
    }
    selectZbOffGroupDevs() { /// Off 제어 group 조회
        let sql = ` SELECT ZB_ADDR, ZB_OFFGRP_RID FROM TB_DEV WHERE ZB_OFFGRP_RID != 0`;
        return this.doSelect(sql);
    }
    selectOnGroupDevMissStat() { // On 그룹에 속해 있지만 ON상태가 아닌 플러그
        let sql = ` SELECT ZB_ADDR, SW_ST, ZB_ONGRP_RID FROM TB_DEV WHERE ZB_ONGRP_RID != 0 AND SW_ST != 1`;
        return this.doSelect(sql);
    }
    selectOffGroupDevMissStat() { // off 그룹에 속해 있지만 off상태가 아닌 플러그
        let sql = ` SELECT ZB_ADDR, SW_ST, ZB_OFFGRP_RID FROM TB_DEV WHERE ZB_OFFGRP_RID != 0 AND SW_ST != 0`;
        return this.doSelect(sql);
    }
    selectZbGroupingStat() {  //지그비 그룹핑 진행상태

        let sql = ` SELECT SUM(ONGRP)  ONGRP_SYNC_CNT
                            , SUM(OFFGRP) OFFGRP_SYNC_CNT
                            , SUM(READGRP) READGRP_SYNC_CNT
                            , COUNT(*) TOT_DEV_CNT
                            , SUM(ONGRP_DEV) ONGRP_DEV_CNT
                            , SUM(OFFGRP_DEV) OFFGRP_DEV_CNT
                            , SUM(RGRP_DEV) READGRP_DEV_CNT
                    FROM (
                    SELECT
                          CASE WHEN ZB_ONGRP_AID  = ZB_ONGRP_RID  THEN 1 ELSE 0 END ONGRP
                        , CASE WHEN ZB_OFFGRP_AID = ZB_OFFGRP_RID THEN 1 ELSE 0 END OFFGRP
                        , CASE WHEN ZB_RGRP_AID   = ZB_RGRP_RID THEN 1 ELSE 0 END READGRP
                        , CASE WHEN ZB_ONGRP_RID   > 0 THEN 1 ELSE 0 END ONGRP_DEV
                        , CASE WHEN ZB_OFFGRP_RID  > 0 THEN 1 ELSE 0 END OFFGRP_DEV
                        , CASE WHEN ZB_RGRP_RID    > 0 THEN 1 ELSE 0 END RGRP_DEV
                    FROM TB_DEV
                    )`;
        return this.doSelect(sql);
    }






    //End for zigbee group cluster







    //TB_GROUP
    selectGroups() {
        const sql = 'SELECT GRP_SQ, GRP_NM, BIGO, REG_DTIME, EDT_DTIME FROM TB_GROUP ORDER BY GRP_SQ ASC ';
        return this.doSelect(sql);
    }
    selectGroup(GRP_SQ) {
        const sql = `SELECT GRP_SQ, GRP_NM, BIGO, REG_DTIME, EDT_DTIME FROM TB_GROUP WHERE  GRP_SQ = ${GRP_SQ}`;
        return this.doSelect(sql);
    }
    insertGroup( grp ) {
        grp.REG_DTIME = xpUtils.getCurDateTime() ;
        grp.EDT_DTIME = grp.REG_DTIME;

        let sql = 'INSERT INTO TB_GROUP(GRP_NM, BIGO, EDT_DTIME, REG_DTIME) VALUES (?, ?, ?, ?)';
        let val = [ grp.GRP_NM, grp.BIGO, grp.EDT_DTIME, grp.REG_DTIME];

        let promise = this.doUpdate(sql, val);

        promise.then( (result) => {
            this.dbEventEmit('TB_GROUP', 'INSERT');
        } );

        return promise;
    }
    updateGroup( objData ) {
        objData.EDT_DTIME = xpUtils.getCurDateTime();

        let sql = 'UPDATE TB_GROUP SET GRP_NM = ?, BIGO = ?, EDT_DTIME = ? WHERE GRP_SQ = ?';
        let val = [ objData.GRP_NM, objData.BIGO, objData.EDT_DTIME, objData.GRP_SQ];

        let promise = this.doUpdate(sql, val);

        let keys = {
            GRP_SQ : objData.GRP_SQ
        };

        promise.then( (result) => {
            this.dbEventEmit('TB_GROUP', 'UPDATE', keys);
        } );

        return promise;
    }
    async deleteGroup  ( grp_sq ) {
        let sql = `DELETE FROM TB_GROUP WHERE GRP_SQ='${grp_sq}'`;

        let promise = this.run(sql);

        let keys = {
            GRP_SQ : grp_sq
        };


        promise.then( (result) => {
            this.dbEventEmit('TB_GROUP', 'DELETE', keys);
        } );

        return promise;
    }



    //TB_HOLIDAY
    selectHolidays(yyyymm) {
        //const sql = `SELECT HOLI_DT, HOLI_NM, REG_DTIME, EDT_DTIME FROM TB_HOLIDAY WHERE CAST(HOLI_DT/100 AS INTEGER)=${yyyymm} ORDER BY HOLI_DT DESC `;
        const sql = `SELECT HOLI_DT, HOLI_NM, REG_DTIME, EDT_DTIME FROM TB_HOLIDAY ORDER BY HOLI_DT DESC `;
        return this.doSelect(sql);
    }
    selectHoliday(HOLI_DT) {
        const sql = `SELECT HOLI_DT, HOLI_NM, REG_DTIME, EDT_DTIME FROM TB_HOLIDAY WHERE HOLI_DT=${HOLI_DT}`;
        return this.doSelect(sql);
    }
    selectTodayIsHoliday() {  //오늘이 휴일인지 조회
        const sql = `SELECT HOLI_DT, HOLI_NM, REG_DTIME, EDT_DTIME FROM TB_HOLIDAY WHERE HOLI_DT=CAST( STRFTIME('%Y%m%d','now', 'localtime') AS INTEGER )`;
        return this.doSelect(sql);
    }
    insertHoliday( holi ) {
        holi.REG_DTIME = xpUtils.getCurDateTime() ;
        holi.EDT_DTIME = holi.REG_DTIME;

        let sql = 'INSERT INTO TB_HOLIDAY(HOLI_DT, HOLI_NM, EDT_DTIME, REG_DTIME) VALUES (?, ?, ?, ?)';
        let val = [ holi.HOLI_DT, holi.HOLI_NM, holi.EDT_DTIME, holi.REG_DTIME];

        let promise = this.doUpdate(sql, val);

        promise.then( (result) => {
            this.dbEventEmit('TB_HOLIDAY', 'INSERT');
        } );

        return promise;
    }
    updateHoliday( holi, holi_dt ) {
        holi.EDT_DTIME = xpUtils.getCurDateTime();

        let sql = 'UPDATE TB_HOLIDAY SET HOLI_NM = ?, EDT_DTIME = ? WHERE HOLI_DT = ?';
        let val = [ holi.HOLI_NM, holi.EDT_DTIME, holi_dt];

        let promise = this.doUpdate(sql, val);

        let keys = {
            HOLI_DT : holi_dt
        };

        promise.then( (result) => {
            this.dbEventEmit('TB_HOLIDAY', 'UPDATE', keys);
        } );

        return promise;
    }
    async deleteHoliday( holi_dt ) {
        let sql = `DELETE FROM TB_HOLIDAY WHERE HOLI_DT='${holi_dt}'`;

        let promise = this.run(sql);

        let keys = {
            HOLI_DT : holi_dt
        };

        promise.then( (result) => {
            this.dbEventEmit('TB_HOLIDAY', 'DELETE', keys);
        });

        return promise;
    }




    //TB_SCHD
    selectSchedules() {
        const sql = 'SELECT SCHD_SQ, SCHD_NM, GRP_SQ, WEEK_BIT, HOLI_YN, BIGO, REG_DTIME, EDT_DTIME FROM TB_SCHD'; // LIMIT 10 OFFSET 10
        return this.doSelect(sql);
    }
    selectSchedule(SCHD_SQ) {
        const sql = `SELECT SCHD_SQ,  SCHD_NM, GRP_SQ, WEEK_BIT, HOLI_YN, BIGO, REG_DTIME, EDT_DTIME FROM TB_SCHD WHERE SCHD_SQ=${SCHD_SQ}`;
        return this.doSelect(sql);
    }
    selectScheduleByGroup(grp_sq) {
        const sql = `SELECT SCHD_SQ,  SCHD_NM, GRP_SQ, WEEK_BIT, HOLI_YN, BIGO, REG_DTIME, EDT_DTIME FROM TB_SCHD WHERE GRP_SQ =${grp_sq}`; // LIMIT 10 OFFSET 10
        return this.doSelect(sql);
    }
    insertSchedule( sch ) {
        sch.REG_DTIME = xpUtils.getCurDateTime() ;
        sch.EDT_DTIME =  sch.REG_DTIME;

        let sql = 'INSERT INTO TB_SCHD(GRP_SQ, SCHD_NM,WEEK_BIT, HOLI_YN, BIGO, EDT_DTIME, REG_DTIME) VALUES (?, ?, ?, ?, ?, ?, ?)';
        let val = [ sch.GRP_SQ, sch.SCHD_NM, sch.WEEK_BIT, sch.HOLI_YN, sch.BIGO, sch.EDT_DTIME, sch.REG_DTIME];

        let promise = this.doUpdate(sql, val);

        promise.then( (result) => {
            this.dbEventEmit('TB_SCHD', 'INSERT');
        } );

        return promise;
    }
    updateSchedule( sch ) {
        sch.EDT_DTIME = xpUtils.getCurDateTime();

        let sql = 'UPDATE TB_SCHD SET GRP_SQ=?, SCHD_NM=?, WEEK_BIT=?, HOLI_YN=?, BIGO=?, EDT_DTIME=? WHERE SCHD_SQ=?';
        let val = [ sch.GRP_SQ, sch.SCHD_NM, sch.WEEK_BIT, sch.HOLI_YN, sch.BIGO, sch.EDT_DTIME, sch.SCHD_SQ];

        let promise = this.doUpdate(sql, val);

        let keys = {
            SCHD_SQ : sch.SCHD_SQ
        };

        promise.then( (result) => {
            this.dbEventEmit('TB_SCHD', 'UPDATE',  keys);
        } );

        return promise;
    }
    async deleteSchedule ( schd_sq ) {
        let sql = `DELETE FROM TB_SCHD WHERE SCHD_SQ='${schd_sq}'`;

        let promise = this.run(sql);

        let keys = {
            SCHD_SQ : schd_sq
        };

        promise.then( (result) => {
            this.dbEventEmit('TB_SCHD', 'DELETE', keys);
        });

        return promise;
    }
    async deleteScheduleByGroup ( group_sq ) {
        let sql = `DELETE FROM TB_SCHD WHERE GRP_SQ='${group_sq}'`;

        let promise = this.run(sql);

        promise.then( (result) => {
            this.dbEventEmit('TB_SCHD', 'DELETE');
        } );

        return promise;
    }

    //TB_SCHD_TM
    selectScheduleTimes() {
        const sql = 'SELECT SC.SCHD_SQ,	SC.GRP_SQ, SC.SCHD_NM, SC.WEEK_BIT, SC.HOLI_YN, TM.SCHD_TM_SQ, TM.CTL_TIME, TM.CTL_CMD, TM.REG_DTIME, TM.EDT_DTIME FROM TB_SCHD_TM TM JOIN TB_SCHD SC ON SC.SCHD_SQ = TM.SCHD_SQ';
        return this.doSelect(sql);
    }
    selectScheduleTime(SCHD_TM_SQ) {
        const sql = `SELECT SC.SCHD_SQ,	SC.GRP_SQ, SC.SCHD_NM, SC.WEEK_BIT, SC.HOLI_YN, TM.SCHD_TM_SQ, TM.CTL_TIME, TM.CTL_CMD, TM.REG_DTIME, TM.EDT_DTIME FROM TB_SCHD_TM TM JOIN TB_SCHD SC ON SC.SCHD_SQ = TM.SCHD_SQ WHERE TM.SCHD_TM_SQ=${SCHD_TM_SQ}`;
        return this.doSelect(sql);
    }
    selectDoRunScheduleTime(isHoliday = false ) { //현지시간(HH24MI) 스케쥴 대상 조회
        let  sql = `SELECT
                      S.SCHD_SQ
                    , S.SCHD_NM
                    , S.GRP_SQ
                    , S.WEEK_BIT
                    , S.HOLI_YN
                    , M.SCHD_TM_SQ
                    , M.CTL_TIME
                    , M.CTL_CMD
                    , M.LAST_RUN_DT
                    , CAST( STRFTIME('%Y%m%d','now', 'localtime') AS INTEGER ) TO_DATE
                FROM TB_SCHD S JOIN TB_SCHD_TM M ON S.SCHD_SQ = M.SCHD_SQ
                WHERE  M.CTL_TIME = STRFTIME('%H%M','now', 'localtime')
                    AND CAST( SUBSTR(S.WEEK_BIT, STRFTIME('%w','now', 'localtime')+1, 1) AS INTEGER ) = 1
                    AND (M.LAST_RUN_DT IS NULL OR  M.LAST_RUN_DT <> CAST( STRFTIME('%Y%m%d','now', 'localtime') AS INTEGER ) )`;
        if( isHoliday )
            sql +=  " AND S.HOLI_YN = 1";   //금일이 휴일이라면 휴일운전 허용한 스케쥴만 조회

        return this.doSelect(sql);
    }
    selectAutoDeviceScheduleTime(isHoliday = false ) { //자동화기기 그룹 스케쥴 설정내용
        let  sql = `SELECT
                      S.SCHD_SQ
                    , S.SCHD_NM
                    , S.GRP_SQ
                    , G.GRP_NM
                    , S.WEEK_BIT
                    , S.HOLI_YN
                    , M.SCHD_TM_SQ
                    , M.CTL_TIME
                    , M.CTL_CMD
                    , M.LAST_RUN_DT
                    , CAST( STRFTIME('%Y%m%d','now', 'localtime') AS INTEGER ) TO_DATE
                    FROM TB_SCHD S JOIN TB_SCHD_TM M ON S.SCHD_SQ = M.SCHD_SQ
                    LEFT JOIN TB_GROUP G ON S.GRP_SQ = G.GRP_SQ
                    WHERE  CAST( SUBSTR(S.WEEK_BIT, STRFTIME('%w','now', 'localtime')+1, 1) AS INTEGER ) = 1
                    AND S.GRP_SQ = 1`;
        if( isHoliday )
            sql +=  " AND S.HOLI_YN = 1";   //금일이 휴일이라면 휴일운전 허용한 스케쥴만 조회

            sql +=  " ORDER BY CTL_CMD, CTL_TIME ";

        return this.doSelect(sql);
    }
    updateDoRunScheduleTimeComplete( SCHD_TM_SQ, LAST_RUN_DT  ) { //스케쥴운전 완료 처리

        let EDT_DTIME = xpUtils.getCurDateTime();

        let sql = 'UPDATE TB_SCHD_TM SET LAST_RUN_DT = ?, EDT_DTIME = ? WHERE SCHD_TM_SQ = ?';
        let val = [ LAST_RUN_DT, EDT_DTIME, SCHD_TM_SQ];

        let promise = this.doUpdate(sql, val);

        let keys = {
            SCHD_TM_SQ : SCHD_TM_SQ
        };

        promise.then( (result) => {
            this.dbEventEmit('TB_SCHD_TM', 'UPDATE', keys);
        } );

        return promise;
    }
    insertScheduleTime( sch ) {
        sch.REG_DTIME = xpUtils.getCurDateTime() ;
        sch.EDT_DTIME = sch.REG_DTIME;

        let sql = 'INSERT INTO TB_SCHD_TM( SCHD_SQ, CTL_TIME, CTL_CMD, EDT_DTIME, REG_DTIME ) VALUES (?, ?, ?, ?, ?)';
        let val = [ sch.SCHD_SQ, sch.CTL_TIME, sch.CTL_CMD, sch.EDT_DTIME, sch.REG_DTIME];

        let promise = this.doUpdate(sql, val);

        promise.then( (result) => {
            this.dbEventEmit('TB_SCHD_TM', 'INSERT');
        } );

        return promise;
    }
    updateScheduleTime( sch ) {
        sch.EDT_DTIME = xpUtils.getCurDateTime();

        let sql = 'UPDATE TB_SCHD_TM SET SCHD_SQ = ?, CTL_TIME = ?, CTL_CMD = ?,  EDT_DTIME = ? WHERE SCHD_TM_SQ = ?';
        let val = [ sch.SCHD_SQ, sch.CTL_TIME, sch.CTL_CMD, sch.EDT_DTIME, sch.SCHD_TM_SQ];

        let promise = this.doUpdate(sql, val);

        let keys = {
            SCHD_TM_SQ : sch.SCHD_TM_SQ
        };

        promise.then( (result) => {
            this.dbEventEmit('TB_SCHD_TM', 'UPDATE', keys);
        } );

        return promise;
    }
    async deleteScheduleTime( schd_tm_sq ) {
        let sql = `DELETE FROM TB_SCHD_TM WHERE SCHD_TM_SQ='${schd_tm_sq}'`;

        let promise = this.run(sql);

        let keys = {
            SCHD_TM_SQ : schd_tm_sq
        };

        promise.then( (result) => {
            this.dbEventEmit('TB_SCHD_TM', 'DELETE', keys);
        } );

        return promise;
    }
    async deleteScheduleTimeBySchdSq ( schd_sq ) {

        let sql = `DELETE FROM TB_SCHD_TM WHERE SCHD_SQ='${schd_sq}'`;

        let promise = this.run(sql);

        let keys = {
            SCHD_SQ : schd_sq
        };
        promise.then( (result) => {
            this.dbEventEmit('TB_SCHD_TM', 'DELETE', keys);
        } );
        return promise;
    }




    //TR_SW_EVNT
    selectSwEvent(fr_date, to_date) {
        const sql = `SELECT E.ZB_ADDR
                    , D.DEV_NM
                    , E.TX_DT
                    , E.TX_TM
                    , E.SW_ST
                    , CASE WHEN E.SW_ST = 0  THEN 'OFF'
                        WHEN E.SW_ST = 1  THEN 'ON'
                        ELSE '-' END SW_ST_NM
                    , E.SAVE_KW
                    , E.SAVE_SEC
                FROM TR_SW_EVNT E LEFT JOIN TB_DEV D ON E.ZB_ADDR = D.ZB_ADDR
                WHERE  E.TX_DT >= ${fr_date} AND E.TX_DT <= ${to_date}
                ORDER BY E.TX_DT DESC, E.TX_TM DESC `;

        return this.doSelect(sql);
    }
    insertSwEvent( ZB_ADDR, SW_ST, SAVE_KW, SAVE_SEC ) {

        if( ZB_ADDR === "" )  return;

        let TX_DT = xpUtils.getCurDate() ;
        let TX_TM = xpUtils.getCurTime() ;

        let sql = 'INSERT INTO TR_SW_EVNT( ZB_ADDR, TX_DT, TX_TM, SW_ST, SAVE_KW, SAVE_SEC) VALUES (?, ?, ?, ?, ?, ?)';
        let val = [ ZB_ADDR, TX_DT, TX_TM, SW_ST, SAVE_KW, SAVE_SEC ];

        let keys = {
            ZB_ADDR : ZB_ADDR,
            TX_DT : TX_DT,
            TX_TM : TX_TM,
        };

        let promise = this.doUpdate(sql, val);
        // promise.then( (result) => {
        //     this.dbEventEmit('TR_SW_EVNT', 'INSERT', keys);
        // } );

        return promise;
    }
    async deleteSwEvent( zb_addr ) {
        let sql = `DELETE FROM TR_SW_EVNT WHERE ZB_ADDR='${zb_addr}'`;
        return this.run(sql);
    }
    selectSwEventForCloud() {
        const sql = ` SELECT ZB_ADDR, TX_DT, TX_TM, SW_ST, SAVE_KW, SAVE_SEC ` +
                    ` FROM TR_SW_EVNT ` +
                    ` WHERE (SND_ST IS NULL OR SND_ST = 0 ) AND TX_DT >= CAST( STRFTIME('%Y%m%d','now', 'localtime', '-30 day' ) AS INTEGER ) ` +
                    ` LIMIT 50`;
        return this.doSelect(sql);
    }
    updateSwEventSndSt( swEventR, sndSt = 1 ){
        let sql = ` UPDATE TR_SW_EVNT SET ` +
                  `  SND_ST=${sndSt} ` +
                  `  WHERE ZB_ADDR=? AND TX_DT = ? AND TX_TM = ? `;   //전송상태 플래그 세움
        let val = [  swEventR.ZB_ADDR, swEventR.TX_DT , swEventR.TX_TM];
        return this.doUpdate(sql, val);
    }


    //TR_CTRL
    selectControl( fr_date,  to_date ) {
        const sql = `SELECT C.CTL_SQ
                    , C.CTL_DT
                    , C.CTL_TM
                    , C.ZB_ADDR
                    , D.DEV_NM
                    , C.GRP_SQ
                    , G.GRP_NM
                    , C.CTL_TYPE
                    , CASE WHEN C.CTL_TYPE = 1  THEN '수동제어'
                        WHEN C.CTL_TYPE = 11 THEN '수동제어-모바일'
                        WHEN C.CTL_TYPE = 2  THEN '스케쥴제어'
                        WHEN C.CTL_TYPE = 22 THEN '스케쥴제어-모바일'
                        ELSE '-' END CTL_TYPE_NM
                    , C.CTL_OBJ
                    , CASE WHEN C.CTL_OBJ = 1  THEN '개별제어'
                        WHEN C.CTL_OBJ = 2  THEN '그룹제어'
                        WHEN C.CTL_OBJ = 3  THEN '전체제어'
                        ELSE '-' END CTL_OBJ_NM
                    , C.CTL_CMD
                    , CASE WHEN C.CTL_CMD = 0  THEN 'OFF'
                        WHEN C.CTL_CMD = 1  THEN 'ON'
                        ELSE '-' END CTL_CMD_NM
                    , C.SCHD_TM_SQ
                    , C.KW
                FROM TR_CTRL C
                    LEFT JOIN TB_DEV D ON C.ZB_ADDR = D.ZB_ADDR
                    LEFT JOIN TB_GROUP G ON C.GRP_SQ = G.GRP_SQ
                WHERE  C.CTL_DT >= ${fr_date} AND C.CTL_DT <= ${to_date}
                ORDER BY C.CTL_DT DESC, C.CTL_TM DESC `;

        return this.doSelect(sql);
    }
    insertControl( dataObj ) {

        dataObj.CTL_DT = xpUtils.getCurDate() ;
        dataObj.CTL_TM = xpUtils.getCurTime() ;

        let sql = 'INSERT INTO TR_CTRL( CTL_DT, CTL_TM, ZB_ADDR, GRP_SQ, CTL_TYPE, CTL_OBJ, CTL_CMD, SCHD_TM_SQ, KW ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, (SELECT KW FROM TB_DEV WHERE ZB_ADDR = ?))';
        let val = [ dataObj.CTL_DT, dataObj.CTL_TM, dataObj.ZB_ADDR, dataObj.GRP_SQ, dataObj.CTL_TYPE, dataObj.CTL_OBJ, dataObj.CTL_CMD, dataObj.SCHD_TM_SQ, dataObj.ZB_ADDR];

        let promise = this.doUpdate(sql, val);

        // promise.then( (result) => {
        //     let keys = {
        //         CTL_SQ : result["lastID"]
        //     };
        //     this.dbEventEmit('TR_CTRL', 'INSERT', keys);
        // } );

        return promise;
    }
    async deleteControl( zb_addr ) {
        let sql = `DELETE FROM TR_CTRL WHERE ZB_ADDR='${zb_addr}'`;
        return this.run(sql);
    }
    selectLatAllControl( ) {  // 최종 전체 제어 명령 찾기  (제어후 10초 ~ 5분 이내 유효한 제어 내용 ) -- 전체제어와 플러그 상태동기화를 위해 호출
        const sql = `SELECT CTL_DT
                , CTL_TM
                , CTL_TYPE
                , CTL_CMD
                , MIN_DTIME
                , MAX_DTIME
                , CUR_DTIME
            FROM
            (
                SELECT CTL_DT, CTL_TM, CTL_TYPE, CTL_CMD
                    , CAST( STRFTIME('%Y%m%d%H%M%S', (CTL_DT / 10000) || '-' ||  SUBSTR('00'|| ((CTL_DT / 100) % 100), -2, 2)  || '-' ||   SUBSTR('00'|| ( CTL_DT % 100), -2, 2) || '  ' || SUBSTR('00'|| (CTL_TM / 10000), -2, 2) || ':' ||  SUBSTR('00'|| ((CTL_TM / 100) % 100), -2, 2)  || ':' ||   SUBSTR('00'|| (CTL_TM % 100), -2, 2)  , '10   second' ) AS INTEGER ) MIN_DTIME
                    , CAST( STRFTIME('%Y%m%d%H%M%S', (CTL_DT / 10000) || '-' ||  SUBSTR('00'|| ((CTL_DT / 100) % 100), -2, 2)  || '-' ||   SUBSTR('00'|| ( CTL_DT % 100), -2, 2) || '  ' || SUBSTR('00'|| (CTL_TM / 10000), -2, 2) || ':' ||  SUBSTR('00'|| ((CTL_TM / 100) % 100), -2, 2)  || ':' ||   SUBSTR('00'|| (CTL_TM % 100), -2, 2)  , '300  second' ) AS INTEGER ) MAX_DTIME
                    , CAST( STRFTIME('%Y%m%d%H%M%S','now','localtime') AS INTEGER )  CUR_DTIME
                FROM TR_CTRL
                WHERE CTL_OBJ = 3
                ORDER BY CTL_DT DESC, CTL_TM DESC
            ) C
            WHERE C.CUR_DTIME > C.MIN_DTIME AND C.CUR_DTIME < C.MAX_DTIME
            LIMIT 1`;
        return this.doSelect(sql);
    }
    selectControltForCloud() {
        const sql = ` SELECT CTL_SQ, CTL_DT, CTL_TM, ZB_ADDR, GRP_SQ, CTL_TYPE, CTL_OBJ, CTL_CMD, SCHD_TM_SQ, KW  ` +
                    ` FROM TR_CTRL ` +
                    ` WHERE (SND_ST IS NULL OR SND_ST = 0 ) AND CTL_DT >= CAST( STRFTIME('%Y%m%d','now', 'localtime', '-30 day' ) AS INTEGER ) ` +
                    ` LIMIT 50`;
        return this.doSelect(sql);
    }
    updateControlSndSt( controR, sndSt = 1 ){
        let sql = ` UPDATE TR_CTRL SET ` +
                  `  SND_ST=${sndSt} ` +
                  `  WHERE CTL_SQ = ? `;   //전송상태 플래그 세움
        let val = [  controR.CTL_SQ ];
        return this.doUpdate(sql, val);
    }









    //TR_DAY
    selectDayReportFromTo(fr_date, to_date, offset) {

        const sql = `SELECT	ZB_ADDR, TX_DT, S_AKWH, E_AKWH, (E_AKWH - S_AKWH) SKWH, SAVE_KW, SAVE_SEC, REG_DTIME, EDT_DTIME FROM TR_DAY WHERE  TX_DT >= ${fr_date} AND TX_DT <= ${to_date} ORDER BY TX_DT DESC`;

        return this.doSelect(sql);
    }
    selectDayReportFromToAtTotal(fr_date, to_date, offset) {
        const sql = `SELECT	TX_DT, SUM(S_AKWH) S_AKWH, SUM(E_AKWH) E_AKWH, SUM(E_AKWH) - SUM(S_AKWH) SKWH, SUM(SAVE_KW) SAVE_KW, SUM(SAVE_SEC) SAVE_SEC
        FROM TR_DAY
        WHERE TX_DT >= ${fr_date} AND TX_DT <= ${to_date}
        GROUP BY TX_DT
        ORDER BY TX_DT DESC`;

        return this.doSelect(sql);
    }
    insertDayReport( dayr ) {

        dayr.REG_DTIME = xpUtils.getCurDateTime() ;
        dayr.EDT_DTIME = xpUtils.getCurDateTime() ;

        let sql = 'INSERT INTO TR_DAY( ZB_ADDR, TX_DT, S_AKWH, E_AKWH, REG_DTIME, EDT_DTIME ) VALUES (?, ?, ?, ?, ?, ?)';
        let val = [ dayr.ZB_ADDR, dayr.TX_DT, dayr.S_AKWH, dayr.E_AKWH, dayr.REG_DTIME, dayr.EDT_DTIME ];

        let promise = this.doUpdate(sql, val);

        // promise.then( (result) => {
        //     let keys = {
        //         ZB_ADDR : dayr.ZB_ADDR,
        //         TX_DT : dayr.TX_DT
        //     };
        //     this.dbEventEmit('TR_DAY', 'INSERT', keys);
        // } );

        return promise;
    }
    updateDayReport( dayr ) {
        dayr.EDT_DTIME = xpUtils.getCurDateTime() ;

        let sql = ` UPDATE TR_DAY SET
                          E_AKWH   = CASE WHEN S_AKWH > ? THEN S_AKWH ELSE ? END
                        , SAVE_KW  = (SELECT SUM(SAVE_KW ) FROM TR_SW_EVNT WHERE TX_DT = ? AND ZB_ADDR = ?)
                        , SAVE_SEC = (SELECT SUM(SAVE_SEC) FROM TR_SW_EVNT WHERE TX_DT = ? AND ZB_ADDR = ?)
                        , EDT_DTIME=?
                        , SND_ST = 0
                    WHERE ZB_ADDR=? AND TX_DT = ?`;
        let val = [ dayr.E_AKWH, dayr.E_AKWH, dayr.TX_DT , dayr.ZB_ADDR, dayr.TX_DT, dayr.ZB_ADDR, dayr.EDT_DTIME, dayr.ZB_ADDR, dayr.TX_DT ];

        let promise = this.doUpdate(sql, val);

        // promise.then( (result) => {
        //     let keys = {
        //         ZB_ADDR : dayr.ZB_ADDR,
        //         TX_DT : dayr.TX_DT
        //     };
        //     this.dbEventEmit('TR_DAY', 'UPDATE', keys);
        // } );

        return promise;

    }
    async deleteDayReport( zb_addr ) {
        let sql = `DELETE FROM TR_DAY WHERE ZB_ADDR='${zb_addr}'`;
        return this.run(sql);
    }
    insertTodayReport() {
        let sql = `INSERT INTO TR_DAY( ZB_ADDR, TX_DT, S_AKWH, E_AKWH, SAVE_KW, SAVE_SEC, EDT_DTIME, REG_DTIME )
        SELECT ZB_ADDR
            , CAST( STRFTIME('%Y%m%d','now', 'localtime') AS INTEGER) TX_DT
            , AKWH S_AKWH
            , AKWH E_AKWH
            , (SELECT SUM(SAVE_KW ) FROM TR_SW_EVNT WHERE TX_DT = CAST( STRFTIME('%Y%m%d','now', 'localtime') AS INTEGER) AND ZB_ADDR = TB_DEV.ZB_ADDR) SAVE_KW
			, (SELECT SUM(SAVE_SEC) FROM TR_SW_EVNT WHERE TX_DT = CAST( STRFTIME('%Y%m%d','now', 'localtime') AS INTEGER) AND ZB_ADDR = TB_DEV.ZB_ADDR) SAVE_SEC
            , STRFTIME('%Y%m%d%H%M%S','now', 'localtime') EDT_DTIME
            , STRFTIME('%Y%m%d%H%M%S','now', 'localtime') REG_DTIME
        FROM TB_DEV
        WHERE ZB_ADDR NOT IN (SELECT ZB_ADDR FROM TR_DAY WHERE TX_DT = CAST( STRFTIME('%Y%m%d','now', 'localtime') AS INTEGER))`;

        let promise = this.run(sql);

        // promise.then( (result) => {
        //     let keys = {
        //         TX_DT : xpUtils.getCurDate()
        //     };
        //     this.dbEventEmit('TR_DAY', 'INSERT', keys);
        // } );

        return promise;


    }
    selectDayReportForColud() {
        const sql = `SELECT	ZB_ADDR, TX_DT, S_AKWH, E_AKWH, SAVE_KW, SAVE_SEC, REG_DTIME, EDT_DTIME ` +
                    `FROM TR_DAY ` +
                    `WHERE  (SND_ST IS NULL OR SND_ST = 0 ) AND TX_DT >= CAST( STRFTIME('%Y%m%d','now', 'localtime', '-30 day' ) AS INTEGER ) ` +
                    `ORDER BY TX_DT ASC ` +
                    `LIMIT 50 ` ;   //미전송 레코드 조회 (최대 30일, 최대 50건 )
        return this.doSelect(sql);
    }
    updateDayReportSndSt( dayr, sndSt = 1 ){
        let sql = ` UPDATE TR_DAY SET ` +
                  `  SND_ST=${sndSt} ` +
                  `  WHERE ZB_ADDR=? AND TX_DT = ? `;   //전송상태 플래그 세움
        let val = [ dayr.ZB_ADDR , dayr.TX_DT ];
        return this.doUpdate(sql, val);
    }
    selectMonthReportFromToAtTotal(fr_month, to_month, offset) {
        const sql = `SELECT	CAST(((TX_DT)/100) AS INTEGER) TX_DT, SUM(S_AKWH) S_AKWH, SUM(E_AKWH) E_AKWH, SUM(E_AKWH) - SUM(S_AKWH) SKWH, SUM(SAVE_KW) SAVE_KW, SUM(SAVE_SEC) SAVE_SEC
        FROM TR_DAY
        WHERE CAST(((TX_DT)/100) AS INTEGER) >= ${fr_month} AND CAST(((TX_DT)/100) AS INTEGER) <= ${to_month}
        GROUP BY CAST(((TX_DT)/100) AS INTEGER)
        ORDER BY CAST(((TX_DT)/100) AS INTEGER) DESC
        LIMIT 10 OFFSET ${offset}`;

        return this.doSelect(sql);
    }




     //TR_HOUR
     selectHourReportFromTo(fr_date, to_date, offset) {

        //const sql = `SELECT	ZB_ADDR, TX_DT, TX_TM, S_AKWH, E_AKWH, (E_AKWH - S_AKWH) SKWH,  REG_DTIME, EDT_DTIME FROM TR_HOUR WHERE  TX_DT >= ${fr_date} AND TX_DT <= ${to_date}  LIMIT 10 OFFSET ${offset}`;
        const sql = `SELECT	ZB_ADDR, TX_DT, TX_TM, S_AKWH, E_AKWH, (E_AKWH - S_AKWH) SKWH,  REG_DTIME, EDT_DTIME FROM TR_HOUR WHERE  TX_DT >= ${fr_date} AND TX_DT <= ${to_date} ORDER BY TX_DT DESC, TX_TM DESC`;

        return this.doSelect(sql);
    }
    selectHourReportFromToAtTotal(fr_date, to_date, offset) {

        const sql = `SELECT	TX_DT, TX_TM, SUM(S_AKWH) S_AKWH, SUM(E_AKWH) E_AKWH, SUM(E_AKWH) - SUM(S_AKWH) SKWH
                     FROM TR_HOUR
                     WHERE  TX_DT >= ${fr_date} AND TX_DT <= ${to_date}
                     GROUP BY TX_DT, TX_TM
                     ORDER BY TX_DT DESC, TX_TM DESC`;

        return this.doSelect(sql);
    }
    insertHourReport( hourR ) {

        hourR.REG_DTIME = xpUtils.getCurDateTime() ;
        hourR.EDT_DTIME = xpUtils.getCurDateTime() ;

        let sql = 'INSERT INTO TR_HOUR( ZB_ADDR, TX_DT, TX_TM, S_AKWH, E_AKWH, REG_DTIME, EDT_DTIME ) VALUES (?, ?, ?, ?, ?, ?, ?)';
        let val = [ hourR.ZB_ADDR, hourR.TX_DT, hourR.TX_TM, hourR.S_AKWH, hourR.E_AKWH, hourR.REG_DTIME, hourR.EDT_DTIME ];

        let promise = this.doUpdate(sql, val);

        // promise.then( (result) => {
        //     let keys = {
        //         ZB_ADDR : hourR.ZB_ADDR,
        //         TX_DT : hourR.TX_DT,
        //         TX_TM : hourR.TX_TM
        //     };
        //     this.dbEventEmit('TR_HOUR', 'INSERT', keys);
        // } );

        return promise;
    }
    updateHourReport( hourR ) {
        hourR.EDT_DTIME = xpUtils.getCurDateTime() ;

        let sql = `UPDATE TR_HOUR SET E_AKWH = CASE WHEN S_AKWH > ? THEN S_AKWH ELSE ? END , EDT_DTIME=?, SND_ST = 0 WHERE ZB_ADDR=? AND TX_DT = ? AND TX_TM = ?`;
        let val = [ hourR.E_AKWH, hourR.E_AKWH, hourR.EDT_DTIME, hourR.ZB_ADDR, hourR.TX_DT, hourR.TX_TM ];
        return this.doUpdate(sql, val);
    }
    async deleteHourReport( zb_addr ) {
        let sql = `DELETE FROM TR_HOUR WHERE ZB_ADDR='${zb_addr}'`;
        return this.run(sql);
    }
    insertToHourReport() {
        let sql = `INSERT INTO TR_HOUR( ZB_ADDR, TX_DT, TX_TM, S_AKWH, E_AKWH, EDT_DTIME, REG_DTIME )
        SELECT ZB_ADDR
            , CAST( STRFTIME('%Y%m%d','now', 'localtime') AS INTEGER)
            , CAST( STRFTIME('%H','now', 'localtime') AS INTEGER)
            , AKWH S_AKWH
            , AKWH E_AKWH
            , STRFTIME('%Y%m%d%H%M%S','now', 'localtime') EDT_DTIME
            , STRFTIME('%Y%m%d%H%M%S','now', 'localtime') REG_DTIME
        FROM TB_DEV
        WHERE ZB_ADDR NOT IN (SELECT ZB_ADDR FROM TR_HOUR WHERE TX_DT = CAST( STRFTIME('%Y%m%d','now', 'localtime') AS INTEGER) AND TX_TM = CAST( STRFTIME('%H','now', 'localtime') AS INTEGER) )`;

        let promise = this.run(sql);

        // promise.then( (result) => {
        //     let keys = {
        //         TX_DT : xpUtils.getCurDate(),
        //         TX_TM : xpUtils.getCurTime()
        //     };
        //     this.dbEventEmit('TR_HOUR', 'INSERT', keys);
        // } );

        return promise;
    }
    selectHourReportForColud() {
        const sql = `SELECT	ZB_ADDR, TX_DT, TX_TM, S_AKWH, E_AKWH, REG_DTIME, EDT_DTIME ` +
                    `FROM TR_HOUR ` +
                    `WHERE  (SND_ST IS NULL OR SND_ST = 0 ) AND TX_DT >= CAST( STRFTIME('%Y%m%d','now', 'localtime', '-10 day' ) AS INTEGER ) ` +
                    `ORDER BY TX_DT ASC ` +
                    `LIMIT 50 `;   //미전송 레코드 조회 (최대 10일, 최대 50건씩)
        return this.doSelect(sql);
    }
    updateHourReportSndSt( hourR, sndSt = 1 ){
        let sql = ` UPDATE TR_HOUR SET ` +
                  `  SND_ST=${sndSt} ` +
                  `  WHERE ZB_ADDR=? AND TX_DT = ? AND TX_TM = ? `;   //전송상태 플래그 세움
        let val = [  hourR.ZB_ADDR, hourR.TX_DT , hourR.TX_TM];
        return this.doUpdate(sql, val);
    }







    //TR_SYSLOG
    selectSysLog() {
        const sql = 'SELECT LOG_SQ, LOG_DT, LOG_TM, LOG_CD, LOG_MSG FROM TR_SYSLOG LIMIT 10'; // LIMIT 10 OFFSET 10
        return this.doSelect(sql);
    }
    insertSysLog( log ) {
        log.LOG_DT = xpUtils.getCurDate() ;
        log.LOG_TM = xpUtils.getCurTime() ;

        let sql = 'INSERT INTO TR_SYSLOG( LOG_DT, LOG_TM, LOG_CD, LOG_MSG ) VALUES (?, ?, ?, ?)';
        let val = [ log.LOG_DT, log.LOG_TM, log.LOG_CD, log.LOG_MSG  ];
        return this.doUpdate(sql, val);
    }


    clearOldHoliyday () {
        return this.run("DELETE FROM TB_HOLIDAY  WHERE HOLI_DT < CAST( STRFTIME('%Y%m%d','now', 'localtime', '-2 year'  ) AS INTEGER )");
    }
    clearOldZbCommand () {
        return this.run("DELETE FROM TZB_COMMAND WHERE CMD_DT  < CAST( STRFTIME('%Y%m%d','now', 'localtime', '-30 day'  ) AS INTEGER )");
    }
    clearOldSyslog () {
        return this.run("DELETE FROM TR_SYSLOG   WHERE LOG_DT  < CAST( STRFTIME('%Y%m%d','now', 'localtime', '-7 day'   ) AS INTEGER )");
    }
    clearOldSwEvent () {
        return this.run("DELETE FROM TR_SW_EVNT  WHERE TX_DT   < CAST( STRFTIME('%Y%m%d','now', 'localtime', '-60 day'  ) AS INTEGER )");
    }
    clearOldControl () {
        return this.run("DELETE FROM TR_CTRL     WHERE CTL_DT  < CAST( STRFTIME('%Y%m%d','now', 'localtime', '-60 day'  ) AS INTEGER )");
    }
    clearOldDayReport () {
        return this.run("DELETE FROM TR_DAY      WHERE TX_DT   < CAST( STRFTIME('%Y%m%d','now', 'localtime', '-365 day' ) AS INTEGER )");
    }
    clearOldHourReport () {
        return this.run("DELETE FROM TR_HOUR      WHERE TX_DT   < CAST( STRFTIME('%Y%m%d','now', 'localtime', '-60 day' ) AS INTEGER )");
    }


    //Common Methods
    async doUpdateCommon(table, values, wheres) {

        let updateColumns = '';
        for (let colName of Object.keys(values))
        {
            if( updateColumns === '' )
                updateColumns += `  ${colName}='${values[colName]}'`;
            else
                updateColumns += `, ${colName}='${values[colName]}'`;
        }

        let whereColums = '';
        for (let colName of Object.keys(wheres))
        {
            if( whereColums === '' )
                whereColums += `  ${colName}='${wheres[colName]}'`;
            else
                whereColums += `, ${colName}='${wheres[colName]}'`;
        }

        let sql = `UPDATE ${table} SET ${updateColumns} WHERE ${whereColums}`;

        console.debug(sql);

        return this.run(sql);
    }

    async doUpdate (sql, values ) {
        return this.run(sql, values);
    }
    async  doSelect( selectSQL ) {
        return new Promise( (resolve, reject) => {
            this.db.all(selectSQL , (err, rows) => {
                if (err) {
                    console.error("doSelect Err" + err);
                    reject(err);
                    return;
                }
                resolve(rows);
            });
        });
    }

    /**
     * Run a SQL statement
     * @param {String} sql
     * @param {Array<any>} values
     * @return {Promise<Object>} promise resolved to `this` of statement result
     */
    run(sql, values) {
        return new Promise((accept, reject) => {
            try {
                this.db.run(sql, values, function(err) {
                    if (err) {
                        console.error("err : " , err, sql);
                        reject(err);
                        return;
                    }
                    accept(this); // node-sqlite puts results on "this" so avoid arrrow fn.
                });
            } catch (err) {
                console.error("err " , err);
                reject(err);
            }
        });
    }

    dbEventEmit(TABLE, OP, KEYS = null  ){

        let data = { TABLE, OP, KEYS};

        this.emit("ondatachange", data );
    }
}

module.exports = new Database();