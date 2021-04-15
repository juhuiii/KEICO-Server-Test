'use strict';
var     os              = require('os');
var     config          = require("config");
const   C_AREA          = require('../common_area');

var     express         = require('express');
var     bodyParser      = require('body-parser')
var     cors            = require('cors');
var     network         = require('network');
var     wifi            = require("node-wifi-scanner");
var     fs              = require('fs');

var     xpUtils         = require("../utils/xg_datetime");
var     webService      = C_AREA.webService = require("./web_service")();
var     dbSql           = C_AREA.dbSql;

const   HTTP_PORT       = config.get('http.port');
const   DEBUG           = false;


//시간 동기화 확인후 Worker Thread 기동 하기 위한 조치
(function runWorkThread(){
    let yyyymmdd = parseInt(xpUtils.getCurDate(), 10) ;
    if( yyyymmdd >= 20191212 ){     //코딩하는 시점 2019월 12월 12일 임 
        require('./thread_worker'); 
    }else{
        setTimeout( ()=>{
            runWorkThread();
        }, 5000);
    }
})();






class WebController { 
    
   
    constructor() {
             
        this.app = express();        
        this.app.set('view engine', 'ejs');
        this.app.engine('html', require('ejs').renderFile );
        this.app.use(cors());
        this.app.use(bodyParser.json());

        this.restApp = express.Router();
        

        this.app.use("/rest", this.restApp);        
        this.app.use("/", express.static(__dirname + '/views'));
        

        ////////////////////// Rest API //////////////////////
        ////////////////////// Rest API //////////////////////
        ////////////////////// Rest API //////////////////////        
        // Gateway 버전내역 
        this.restApp.get('/version', async (req, res) => {     
            DEBUG && console.info(req.method, req.originalUrl); let _this = this;
            
            try
            {   
                let version = "2.1";
                let hist = "";
                hist += `<h1>Gateway System</h1>`;
                hist += `<h3>Version : ${version}</h3>`;
                hist += `<hr/>`;
                hist += `- 2020.01.13 : Apply Cloud System`;
                hist += `- 2020.02.13 : Apply Network Setting on Admin`;
                hist += `- 2020.02.24 : Apply Network(format) Setting on Admin`;
                hist += `- 2020.02.27 : Apply Network(format) and wifi Setting on Admin`;
                hist += `- 2020.04.08 : Apply AUTO ADD COLUMN 'SND_ST' ON 4 TABLES`;
                hist += `- 2020.04.14 : calibrate skwh on report at reset plug `;
                hist += `- 2020.04.26 : iptime plug auto reset and start `;

                 

                res.send( hist );
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }            
        });



        // 지그비 채널검색 
        this.restApp.get('/find_channel', async (req, res) => {     
            DEBUG && console.info(req.method, req.originalUrl); let _this = this;
            
            try
            {
                await webService.findZBChannel();

                res.send( this.getResPacket(0, `Zigbee Find Channel OK`,""));
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }            
        });


        //지그비 퍼밋 조인
        this.restApp.get('/permit_join/:SEC', async (req, res) => {     
            DEBUG && console.info(req.method, req.originalUrl); let _this = this;
            
            let SEC = req.params.SEC || ''; 
            try
            {       
                await webService.permitJoin( SEC );
                res.send(this.getResPacket(0, `Zigbee Permit Join OK`,""));
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }
        });

        
        

        //Report Config (리포트 주기 설정)
        this.restApp.get('/report_config', async (req, res) => {     
            DEBUG && console.info(req.method, req.originalUrl); let _this = this;

            let param = {};
            param["ZB_ADDR"] = req.query.addr64 || '';       //64 bit Address 
            param["KIND"]    = req.query.knd    || '';       //KIND  0(ON/OFF),  1(KW) ,2(KWH)
            param["MIN"]     = req.query.min    || '';       //min
            param["MAX"]     = req.query.max    || '';       //max 
            param["VAL"]     = req.query.val    || '';       //change value  
            
            try
            {           
                await webService.setReportConfig( param );                                       
                res.send(this.getResPacket(0, `Zigbee Set Report Config  OK`,""));
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }            
        });



        //Network(16 BIT) Address 요청 
        this.restApp.get('/nwk_addr', async (req, res) => {     
            DEBUG && console.info(req.method, req.originalUrl); let _this = this;

            let ZB_ADDR = req.query.addr64 || '';      // 64 bit Address 
            
            try
            { 
                await webService.getGet16BitAddr( ZB_ADDR );
                res.send(this.getResPacket(0, `Network Addr(16BIT) Request OK`,""));
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }            
        });



        
        //시간동기화 (태블릿 터치로 부터 시간 동기화 메세지 보냄)
        this.restApp.get('/time_sync', async (req, res) => {     
            DEBUG && console.info(req.method, req.originalUrl); let _this = this;

            let TIME = req.query.time || '';       //Current Time
            try
            {       
                await webService.setTimeSync( TIME );
                                       
                res.send(this.getResPacket(0, `시간동기 ${TIME} OK`,""));
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }            
        });




        this.restApp.get('/sites', async (req, res) => {             //현장정보 조회 
            DEBUG && console.info(req.method, req.originalUrl); let _this = this;

            try
            {       
                let rows = await webService.selSites();

                res.send(_this.makeDataRespons(rows));
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }
            
        });


        this.restApp.post('/sites/:STE_SQ', async (req, res) => {     //현장정보 수정 
            DEBUG && console.info(req.method, req.originalUrl); let _this = this;
                        
            let STE_SQ = req.params.STE_SQ || ''; 

            
            delete req.body["INS_DT_STR"];   //업데이트 되면 안되는 항목들 
            delete req.body["INS_DT"];       //업데이트 되면 안되는 항목들 

            delete req.body["REG_DTIME"];
            delete req.body["WORK_ETM_STR"];
            delete req.body["WORK_STM_STR"];

            try
            {       
                let rtn = await webService.udtSites( req.body, STE_SQ);

                res.send(this.getResPacket());
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }
        });



        //플러그 목록조회
        this.restApp.get('/devices', async (req, res) => {             
            DEBUG && console.info(req.method, req.originalUrl); let _this = this;

            try
            {       
                let rows = await webService.selDevices();

                res.send(_this.makeDataRespons(rows));
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }
        });

        //플러그 개별조회
        this.restApp.get('/devices/:ZB_ADDR', async (req, res) => {   
            DEBUG && console.info(req.method, req.originalUrl); let _this = this; 
            
            let ZB_ADDR = req.params.ZB_ADDR || ''; 

            try
            {       
                let rows = await webService.selDevices(ZB_ADDR);
                res.send(_this.makeDataRespons(rows, true ));
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }
        });

        //플러그 삭제
        this.restApp.delete('/devices/:ZB_ADDR',  async (req, res) => {   
            DEBUG && console.info(req.method, req.originalUrl); let _this = this;

            let ZB_ADDR = req.params.ZB_ADDR || ''; 

            try
            {               
                await webService.delDevice(ZB_ADDR);
                res.send(this.getResPacket());
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }
        });        

        //플러그 정보수정 
        this.restApp.post('/devices/:ZB_ADDR', async (req, res) => {   
            DEBUG && console.info(req.method, req.originalUrl); let _this = this;
                        
            let ZB_ADDR = req.params.ZB_ADDR || ''; 
            
            delete req.body["SW_ST"];       //업데이트 되면 안되는 항목들 
            delete req.body["KW"];
            delete req.body["AKWH"];
            delete req.body["RCV_DT"];
            delete req.body["RCV_TM"];
            delete req.body["BIGO"];
            delete req.body["REG_DTIME"];

            
            delete req.body["ZB_RGRP_AID"];
            delete req.body["ZB_ONGRP_AID"];
            delete req.body["ZB_OFFGRP_AID"];
            delete req.body["ZB_RGRP_RID"];
            delete req.body["ZB_ONGRP_RID"];
            delete req.body["ZB_OFFGRP_RID"];

            if( req.body["MANU_CTL_ALLOW"] == 0 ) {   //전체제어 허용여부 {허용안하는경우 ON/OFF Zigbee그룹에서 제외 }
                req.body["ZB_ONGRP_AID"] = 0;
                req.body["ZB_OFFGRP_AID"] = 0;
            }
        
            if( req.body["OFF_DELY"] > 0 )    //OFF지연값 설정시 OFF Zigbee그룹에서 제외
            {
                req.body["ZB_OFFGRP_AID"] = 0;
            }
            
            try
            {               
                await webService.udtDevice(ZB_ADDR, req.body);
                res.send(this.getResPacket());
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            } 
        });
       

        //그룹 목록 조회
        this.restApp.get('/groups', async (req, res) => {

            DEBUG && console.info(req.method, req.originalUrl); let _this = this;

            try {
                let rows = await webService.selGroups();
                res.send(_this.makeDataRespons(rows));
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }           
        });


        //그룹 신규등록
        this.restApp.post('/groups', async (req, res) => {              
            DEBUG && console.info(req.method, req.originalUrl); let _this = this;
            
            try {
                let rtn = await webService.insGroup(req.body);
                res.send(this.getResPacket());
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }
        });


        //그룹 개별조회
        this.restApp.get('/groups/:GRP_SQ', async (req, res) => {   
            DEBUG && console.info(req.method, req.originalUrl); let _this = this;

            let GRP_SQ = req.params.GRP_SQ || ''; 

            try {
                let rows = await webService.selGroups(GRP_SQ);
                res.send(_this.makeDataRespons(rows));
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }
        });

        //그룹 삭제
        this.restApp.delete('/groups/:GRP_SQ', async (req, res) => {   
            DEBUG && console.info(req.method, req.originalUrl); let _this = this;

            let GRP_SQ = req.params.GRP_SQ || ''; 
            try
            {
                let rtn = await webService.delGroup(GRP_SQ);
                                
                res.send(this.getResPacket());
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }
        }); 

        //그룹 정보수정 
        this.restApp.post('/groups/:GRP_SQ', async (req, res) => {   
            DEBUG && console.info(req.method, req.originalUrl); let _this = this;

            let GRP_SQ = req.params.GRP_SQ || ''; 

            try
            {
                let rtn = await webService.udtGroup(GRP_SQ, req.body );
                                
                res.send(this.getResPacket());
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }
        });



        this.restApp.get('/devices/:ZB_ADDR/on', async (req, res) => {   //플러그 ON 제어 
            DEBUG && console.info(req.method, req.originalUrl); let _this = this;

            let ZB_ADDR = req.params.ZB_ADDR || '';

            try 
            {
          
                let filter = await webService.plugOn(ZB_ADDR);

                let manuFilterMsg = "";
                if( filter.maun_ctl_allow_filter.length > 0 )
                    manuFilterMsg = `수동제어 불가(${filter.maun_ctl_allow_filter.length})`;

                if( filter.direct_control.length <= 0 )
                {
                    res.send(this.getResPacket(0, `ON제어할 기기를 찾지 못했습니다. ${manuFilterMsg}, `, filter));
                    return; 
                }

                let totControlCnt = filter.direct_control.length ;        //제어된 갯수 
                let totExceptCnt  = filter.maun_ctl_allow_filter.length   //예외된 갯수

                res.send(this.getResPacket(0, `${totControlCnt}개의 기기를 ON하였습니다. 예외기기=${totExceptCnt}`, filter));
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }

        });
     


        this.restApp.get('/groups/:GRP_SQ/on', async (req, res) => {   //그룹 ON 제어 
            DEBUG && console.info(req.method, req.originalUrl); let _this = this;

            let GRP_SQ = req.params.GRP_SQ || ''; 


            try
            {

                let filter = await webService.groupOn( GRP_SQ );

                let manuFilterMsg = "";
                if( filter.maun_ctl_allow_filter.length > 0 )
                    manuFilterMsg = `수동제어 불가(${filter.maun_ctl_allow_filter.length})`;

                if( filter.direct_control.length <= 0 )
                {
                    res.send(this.getResPacket(0, `ON 제어 할 기기를 찾지 못했습니다. ${manuFilterMsg}, `, filter));
                    return; 
                }
            
                let totControlCnt = filter.direct_control.length ;          //제어된 갯수 
                let totExceptCnt  = filter.maun_ctl_allow_filter.length     //예외된 갯수

                res.send( this.getResPacket(0, `${totControlCnt}개의 기기를 ON 하였습니다. 예외기기=${totExceptCnt}`, result));
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }
        });

        

        //전체 ON 제어 ( Zigbee Group )
        this.restApp.get('/all/on', async (req, res) => {   //전체 ON 제어 
            DEBUG && console.info(req.method, req.originalUrl); let _this = this;

            try
            {
                let onGroupDevs = await webService.plugAllOn();

                if( onGroupDevs.length <= 0 )
                {                    
                    res.send( this.getResPacket(0, `Zigbee ON Group을 찾지 못했습니다.`));
                    return; 
                }      

                res.send(this.getResPacket(0, `${onGroupDevs.length }개의 플러그를 ON하였습니다.`)); 
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }
           
        });
    
    


        this.restApp.get('/devices/:ZB_ADDR/off', async (req, res) => {   //플러그 OFF 제어 
            DEBUG && console.info(req.method, req.originalUrl); let _this = this;

            let ZB_ADDR = req.params.ZB_ADDR || '';
            let FILTER  = req.query.FILTER   || ''; //대기전력 무시 여부

            try 
            {
                let filter = await webService.plugOff( ZB_ADDR,  FILTER );
                
                let manuFilterMsg = "";
                if( filter.maun_ctl_allow_filter.length > 0 )
                    manuFilterMsg = `수동제어 불가(${filter.maun_ctl_allow_filter.length})`;    
                
                let useKwFilterMsg = "";
                if( filter.use_kw_filter.length > 0 )
                    useKwFilterMsg = `사용중(${filter.use_kw_filter.length})`;
                
                if( filter.direct_control.length <= 0 && filter.reserv_control.length <= 0 )    //제어된 플러그가 없는경우 
                {
                    res.send(this.getResPacket(0, `OFF 가능한 기기가 아닙니다. ${useKwFilterMsg},${manuFilterMsg}`, filter));
                    return; 
                }

                let totControlCnt = filter.direct_control.length + filter.reserv_control.length;        //제어된 갯수 
                let totExceptCnt  = filter.maun_ctl_allow_filter.length + filter.use_kw_filter.length;  //예외된 갯수(수동제어불허, 대기전력 체크)

                res.send(this.getResPacket(0, `${totControlCnt}개의 기기를 OFF 하였습니다. 예외기기=${totExceptCnt}`, filter));
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }            

        });


        //그룹 OFF 제어 
        this.restApp.get('/groups/:GRP_SQ/off', async (req, res) => {   
            DEBUG && console.info(req.method, req.originalUrl); let _this = this;

            let GRP_SQ = req.params.GRP_SQ  || ''; 
            let FILTER = req.query.FILTER   || ''; 

            try
            {
                let filter = await webService.groupOff( GRP_SQ,  FILTER );

                let manuFilterMsg = "";
                if( filter.maun_ctl_allow_filter.length > 0 )
                    manuFilterMsg = `수동제어 불가(${filter.maun_ctl_allow_filter.length})`;
                
                let useKwFilterMsg = "";
                if( filter.use_kw_filter.length > 0 )
                    useKwFilterMsg = `사용중(${filter.use_kw_filter.length})`;
                
                if( filter.direct_control.length <= 0 && filter.reserv_control.length <= 0 )
                {
                    res.send( this.getResPacket(0, `OFF 가능한 기기를 찾지 못했습니다. ${useKwFilterMsg},${manuFilterMsg}`, filter));
                    return; 
                }

                let totControlCnt = filter.direct_control.length + filter.reserv_control.length;        //제어된 갯수 
                let totExceptCnt  = filter.maun_ctl_allow_filter.length + filter.use_kw_filter.length; //예외된 갯수
 
                res.send( this.getResPacket(0, `${totControlCnt}개의 기기를 OFF 하였습니다. 예외기기=${totExceptCnt}`, filter));
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }           
        });


        



        // Zigbee Group 을 이용한 전체 OFF제어  2Version
        this.restApp.get('/all/off', async (req, res) => {   //전체 OFF 제어 
            DEBUG && console.info(req.method, req.originalUrl); let _this = this;

            let FILTER = req.query.FILTER || 'n';      //기준전력 체크 유무 

            try
            {
                let offGroupDevs = await webService.plugAllOff( FILTER );                
                if( offGroupDevs.length <= 0 )
                {                    
                    res.send( this.getResPacket(0, `Zigbee OFF Group Dev 을 찾지 못했습니다.`));
                    return; 
                }               

                res.send(this.getResPacket(0, `${offGroupDevs.length }개의 플러그를 OFF하였습니다.`)); 
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }
        });



        //휴일 목록조회
        this.restApp.get('/holidays', async (req, res) => {             
            DEBUG && console.info(req.method, req.originalUrl); let _this = this;

            let YYYYMM = req.query.YYYYMM || '';

            try {
                let rows = await webService.selHolidays(YYYYMM);
                res.send(_this.makeDataRespons(rows));
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }
        });

        //휴일 상세조회
        this.restApp.get('/holidays/:HOLI_DT', async (req, res) => {   
            DEBUG && console.info(req.method, req.originalUrl); let _this = this; 

            let HOLI_DT = req.params.HOLI_DT || ''; 
            try {
                let rows = await webService.selHoliday(HOLI_DT);
                res.send(_this.makeDataRespons(rows, true));
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }
        });

         //휴일 등록
        this.restApp.post('/holidays', async (req, res) => {            
            DEBUG && console.info(req.method, req.originalUrl); let _this = this;

            try {
                let rtn = await webService.insHoliday(req.body);
                res.send(this.getResPacket());
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }
        });

        //휴일 삭제
        this.restApp.delete('/holidays/:HOLI_DT', async (req, res) => {   
            DEBUG && console.info(req.method, req.originalUrl); let _this = this;

            let HOLI_DT = req.params.HOLI_DT || ''; 

            try {
                let rtn = await webService.delHoliday( HOLI_DT );
                res.send(this.getResPacket());
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }
        });  
        
        //휴일 정보수정 
        this.restApp.post('/holidays/:HOLI_DT', async (req, res) => {   
            DEBUG && console.info(req.method, req.originalUrl); let _this = this;

            let HOLI_DT = req.params.HOLI_DT || ''; 
    
            try {
                let rtn = await webService.udtHoliday( HOLI_DT, req.body);
                res.send(this.getResPacket());
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }
        });




        //금일 운전될 플러그 스케쥴 
        this.restApp.get('/autodev_schedules', async (req, res) => {      
            DEBUG &&  console.info(req.method, req.originalUrl); let _this = this;
                                    
            try {
                let rows = await webService.selScheduleToday( );
                res.send(_this.makeDataRespons(rows));
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }        
        });

        //스케쥴 목록조회
        this.restApp.get('/schedules', async (req, res) => {             
            DEBUG &&  console.info(req.method, req.originalUrl); let _this = this;

            try {
                let rows = await webService.selSchedules( );
                res.send(_this.makeDataRespons(rows));
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }
        });

        //스케쥴 정보 상세 
        this.restApp.get('/schedules/:SCHD_SQ', async (req, res) => {   
            DEBUG && console.info(req.method, req.originalUrl); let _this = this; 
                        
            let SCHD_SQ = req.params.SCHD_SQ || ''; 

            try {
                let rtn = await webService.selSchedule(  SCHD_SQ );
                res.send(_this.makeDataRespons(rows, true));
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }
        });

        //스케쥴 등록
        this.restApp.post('/schedules', async (req, res) => {             
            DEBUG && console.info(req.method, req.originalUrl); let _this = this;
            
            try {
                let rtn = await webService.insSchedule(req.body);
                res.send(this.getResPacket());
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }
        });

        //스케쥴 삭제
        this.restApp.delete('/schedules/:SCHD_SQ', async (req, res) => {   
            DEBUG && console.info(req.method, req.originalUrl); let _this = this;

            let SCHD_SQ = req.params.SCHD_SQ || ''; 
            
            try {
                let rtn = await webService.delSchedule( SCHD_SQ );
                res.send(this.getResPacket());
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }
        });  
        

        //스케쥴 정보수정 
        this.restApp.post('/schedules/:SCHD_SQ', async (req, res) => {   
            DEBUG && console.info(req.method, req.originalUrl); let _this = this;
            
            let SCHD_SQ = req.params.SCHD_SQ || ''; 

            try {
                let rtn = await webService.udtSchedule( SCHD_SQ, req.body);
                res.send(this.getResPacket());
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }

        });







        //시간스케쥴  목록조회
        this.restApp.get('/schedules_times', async (req, res) => {             
            DEBUG && console.info(req.method, req.originalUrl); let _this = this;
      
            try {
                let rows = await webService.selScheduleTimes( );
                res.send(_this.makeDataRespons(rows));
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }
        });

        //시간스케쥴 상세
        this.restApp.get('/schedules_times/:SCHD_TM_SQ', async (req, res) => {   
            DEBUG && console.info(req.method, req.originalUrl); let _this = this; 
            
            let SCHD_TM_SQ = req.params.SCHD_TM_SQ || ''; 
            try {
                let rows = await webService.selScheduleTime(  SCHD_TM_SQ );
                res.send(_this.makeDataRespons(rows, true));
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }
        });

        //시간스케쥴  등록
        this.restApp.post('/schedules_times', async (req, res) => {             
            DEBUG && console.info(req.method, req.originalUrl); let _this = this;

            try {
                let rtn = await webService.insScheduleTime(req.body);
                res.send(this.getResPacket());
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }
        });

        //시간스케쥴  삭제
        this.restApp.delete('/schedules_times/:SCHD_TM_SQ', async (req, res) => {   
            DEBUG && console.info(req.method, req.originalUrl); let _this = this;
            
            let SCHD_TM_SQ = req.params.SCHD_TM_SQ || ''; 

            try {
                let rtn = await webService.delScheduleTime( SCHD_TM_SQ );
                res.send(this.getResPacket());
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }
        });        


        //시간스케쥴  정보수정 
        this.restApp.post('/schedules_times/:SCHD_TM_SQ', async (req, res) => {   
            DEBUG && console.info(req.method, req.originalUrl); let _this = this;
            
            let SCHD_TM_SQ = req.params.SCHD_TM_SQ || ''; 

            try {
                let rtn = await webService.udtScheduleTime( SCHD_TM_SQ, req.body);
                res.send(this.getResPacket());
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }
        });



        //=======================================================================
        // 스케쥴 일자 정보 및 시간정보 동시 처리 
        //
        //=======================================================================
        //시간 스케쥴 조회
        this.restApp.get('/schedule_once', async (req, res) => {             
            DEBUG && console.info(req.method, req.originalUrl); let _this = this;
                         
            try {
                let rows = await webService.selScheduleTimes( );
                res.send(_this.makeDataRespons(rows));
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }
        });


        //한번에 스케쥴 일자정보, 시간정보 한번에 삭제 (1:1)
        this.restApp.delete('/schedule_once/:SCHD_SQ', async (req, res) => {   
            DEBUG && console.info(req.method, req.originalUrl); let _this = this;
            
            let SCHD_SQ = req.params.SCHD_SQ || ''; 

            try{
                let rtn = await webService.delSchedule( SCHD_SQ );

                res.send(this.getResPacket());
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }
        });        

        //한번에 스케쥴 일자정보, 시간정보 한번에 등록 (1:1)
        this.restApp.post('/schedule_once', async (req, res) => {   
            DEBUG && console.info(req.method, req.originalUrl); let _this = this;

            try{            
                
                let rtn = await webService.insSchedule( req.body );
                
                req.body["SCHD_SQ"] =  rtn["lastID"];                
                await webService.insScheduleTime(req.body );
                
                res.send(this.getResPacket());
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }
        });                





        //일보고서 조회 
        this.restApp.get('/report_day', async (req, res) => {             
            DEBUG && console.info(req.method, req.originalUrl); let _this = this;
            
            let frDate = req.query.FR_DATE || xpUtils.getCurDate() ; 
            let toDate = req.query.TO_DATE || xpUtils.getCurDate() ; 
            let offset = 0;
           
            try
            {
                let rows = await webService.selDayReport( frDate, toDate, offset );                
                res.send(_this.makeDataRespons(rows));
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }
        });



        //시간 보고서 조회 
        this.restApp.get('/report_hour', async (req, res) => {            
            DEBUG && console.info(req.method, req.originalUrl); let _this = this;

            let frDate = req.query.FR_DATE || xpUtils.getCurDate() ; 
            let toDate = req.query.TO_DATE || xpUtils.getCurDate() ; 
            let offset = 0;

            try
            {
                let rows = await webService.selHourReport( frDate, toDate, offset );                
                res.send(_this.makeDataRespons(rows));
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }            
        });



        //종합 월 보고서 조회 
        this.restApp.get('/report_mon/total', async (req, res) => {
            DEBUG && console.info(req.method, req.originalUrl); let _this = this;
        
            let cDate = new Date() ;
            let pDate = new Date().setDate(0);
            
            let frDate = req.query.FR_MONTH || xpUtils.getYYYYMM( pDate ) ; 
            let toDate = req.query.TO_MONTH || xpUtils.getYYYYMM( cDate ) ; 
            let offset = 0;
            
            try
            {
                let rows = await webService.selMonReportTot( frDate, toDate, offset );                
                res.send(_this.makeDataRespons(rows));
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }
        });


         //종합 일보고서 조회 
         this.restApp.get('/report_day/total', async (req, res) => {             
            DEBUG && console.info(req.method, req.originalUrl); let _this = this;
                             
            let frDate = req.query.FR_DATE || xpUtils.getCurDate() ; 
            let toDate = req.query.TO_DATE || xpUtils.getCurDate() ; 
            let offset = 0;

            try
            {
                let rows = await webService.selDayReportTot( frDate, toDate, offset );                
                res.send(_this.makeDataRespons(rows));
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            } 
        });




        //종합 시간 보고서 조회 
        this.restApp.get('/report_hour/total', async (req, res) => {            
            DEBUG && console.info(req.method, req.originalUrl); let _this = this;
    
            let frDate = req.query.FR_DATE || xpUtils.getCurDate() ; 
            let toDate = req.query.TO_DATE || xpUtils.getCurDate() ; 
            let offset = 0;

            try
            {
                let rows = await webService.selHourReportTot( frDate, toDate, offset );                
                res.send(_this.makeDataRespons(rows));
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }
        });




        //플러그 동작이력 
        this.restApp.get('/report_swevnt', async (req, res) => {             
            DEBUG && console.info(req.method, req.originalUrl); let _this = this;
            
            let frDate = req.query.FR_DATE || xpUtils.getCurDate() ; 
            let toDate = req.query.TO_DATE || xpUtils.getCurDate() ; 
            let offset = 0;
           
            try
            {
                let rows = await webService.selSwEvntReport( frDate, toDate);
                res.send(_this.makeDataRespons(rows));
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }
        });


        //플러그 제어이력 
        this.restApp.get('/report_control', async (req, res) => {             
            DEBUG && console.info(req.method, req.originalUrl); let _this = this;
            
            let frDate = req.query.FR_DATE || xpUtils.getCurDate() ; 
            let toDate = req.query.TO_DATE || xpUtils.getCurDate() ; 
            let offset = 0;
            
            try
            {
                let rows = await webService.selControlReport( frDate, toDate);
                res.send(_this.makeDataRespons(rows));
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }
        });








        ////////////////////////////////////////////////////////////////////////
        ////////////////////////////////  ADMIN ////////////////////////////////
        ////////////////////////////////  ADMIN ////////////////////////////////
        ////////////////////////////////  ADMIN ////////////////////////////////        
        ////////////////////////////////////////////////////////////////////////
        
        // 지그비 그룹 초기화         
        this.restApp.get('/admin/reset_zbgroup', async (req, res) => {     
            DEBUG && console.info(req.method, req.originalUrl); let _this = this;
            
            try
            {       
                await webService.zbGroupReset();
                res.send(this.getResPacket(0, `ZIGBEE GROUP RESET OK`,""));
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }            
        });


        //지그비그룹핑 상태 또는 진행율  조회
        this.restApp.get('/admin/stat_zbgroup',  async (req, res) => {    
            DEBUG && console.info(req.method, req.originalUrl); let _this = this; 
            
            try
            {
                let rows = await webService.selZbGroups( );                
                res.send(_this.makeDataRespons(rows, true));
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }

        });



        //디바이스명 초기화 
        this.restApp.get('/admin/devices/devnm_init', async (req, res) => {             //플러그 디바이스명 초기화 
            DEBUG && console.info(req.method, req.originalUrl); let _this = this;

            let ignore_pre_set = req.query.ignore_pre_set || 'n' ;     //이전설정 무시여부 (기본 무시 하지 않음)

            try
            {                  
                let idx = webService.initDevName( ignore_pre_set );
                res.send(this.getResPacket(0, `${idx}개 디바이스명 수정완료`,""));
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }        
        });



        //현재 동작중인 네트워크  읽기 
        this.restApp.get('/admin/network_info', async (req, res) => {    
            DEBUG && console.info(req.method, req.originalUrl); let _this = this; 

            try { 
                if ( os.platform() != "linux" ||  os.arch() != "arm" ) {
                    throw new Error("현재 동작중인 네트워크 정보 읽기 실패 - 게이트웨이가 아닙니다.");
                }

                network.get_interfaces_list( (err, list) => { 
                    console.log( list );   
                    res.send(this.getResPacket(0, "OK", list));
                });
                
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }            
        });


        //와이파이 SCAN   
        this.restApp.get('/admin/wifi_scan', async (req, res) => {    
            DEBUG && console.info(req.method, req.originalUrl); let _this = this; 
            
            try{
                
                console.log( "process.platform : ", process.platform);

                if ( os.platform() != "linux" ||  os.arch() != "arm" ) {
                    throw new Error(" WIFI  스캔 실패 - 게이트웨이가 아닙니다.");
                }

                wifi.scan( (err, wifis) => {
                    if ( err ) {              
                        console.error(reason.message);
                        res.send(_this.makeErrorResponse(1, reason));
                    }
                    else
                    {
                        // console.log(wifis);
                        res.send(this.getResPacket(0, "OK", wifis));
                    }
                });
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }            
        });


        //네트워크 설정파일 읽기 
        this.restApp.get('/admin/network_file', async (req, res) => {    
            DEBUG && console.info(req.method, req.originalUrl); let _this = this; 

            try {
                
                let ifstr = await webService.readNetFile();
                
                res.send(this.getResPacket(0, "/etc/network/interfaces 파일내용", ifstr));
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }            
        });
           
        //save network 설정 쓰기 
        this.restApp.post('/admin/network_file', async (req, res) => {    
            DEBUG && console.info(req.method, req.originalUrl); let _this = this; 
   
            try{

                await webService.writeNetFile(req.body )
                res.send(this.getResPacket(0, "저장 되었습니다."));

            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }            
        });



        
        //네트워크 설정파일 읽기 (JSON 포맷형식)
        this.restApp.get('/admin/network_file_fmt', async (req, res) => {    
            DEBUG && console.info(req.method, req.originalUrl); let _this = this; 

            try {
                
                let ifstr = await webService.readNetFileFormat();
                
                res.send(this.getResPacket(0, "/etc/network/interfaces 파일내용", ifstr));
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }            
        });
           
        //save network 설정 쓰기 (JSON 포맷형식)
        this.restApp.post('/admin/network_file_fmt', async (req, res) => {    
            DEBUG && console.info(req.method, req.originalUrl); let _this = this; 
   
            try{

                await webService.writeNetFileFormat(req.body )
                res.send(this.getResPacket(0, "저장 되었습니다."));

            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }            
        });




        




        //와이파이 설정파일 읽기 
        this.restApp.get('/admin/wifi_file', async (req, res) => {    
            DEBUG && console.info(req.method, req.originalUrl); let _this = this; 

            try{                                
                let ifstr = await webService.readWifiFile();
                res.send(this.getResPacket(0, "/etc/wpa_supplicant/wpa_supplicant.conf 파일내용", ifstr));
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }            
        });


        //와이파이 설정 파일 저장 
        this.restApp.post('/admin/wifi_file', async (req, res) => {    
            DEBUG && console.info(req.method, req.originalUrl); let _this = this; 
   
            try{

                await webService.writeWifiFile(req.body )
                res.send(this.getResPacket(0, "저장 되었습니다."));

            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }            
        });





        //와이파이 설정파일 읽기 (포맷형식으로)
        this.restApp.get('/admin/wifi_file_fmt', async (req, res) => {    
            DEBUG && console.info(req.method, req.originalUrl); let _this = this; 

            try{                                
                let ifstr = await webService.readWifiFileFormat();
                res.send(this.getResPacket(0, "/etc/wpa_supplicant/wpa_supplicant.conf 파일내용", ifstr));
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }            
        });


        //와이파이 설정 파일 저장 (포맷형식으로)
        this.restApp.post('/admin/wifi_file_fmt', async (req, res) => {    
            DEBUG && console.info(req.method, req.originalUrl); let _this = this; 
   
            try{

                await webService.writeWifiFileFormat(req.body )
                res.send(this.getResPacket(0, "저장 되었습니다."));

            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }            
        });







        this.restApp.get('/admin/restartnetwork', async (req, res) => {    
            DEBUG && console.info(req.method, req.originalUrl); let _this = this; 
   
            try{
                
                res.send(this.getResPacket(0, "네트워크를 재시작 했습니다."));
                await webService.restartNetwork();                

            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }            
        });


        
        this.restApp.get('/admin/reboot', async (req, res) => {    
            DEBUG && console.info(req.method, req.originalUrl); let _this = this; 
   
            try{
                res.send(this.getResPacket(0, "리부팅 하였습니다."));

                await webService.reboot();
            }
            catch ( reason )
            {
                console.error(reason.message);
                res.send(_this.makeErrorResponse(1, reason));
            }            
        });


        this.start();
    }   //end of constructor

    
    
    start() {
        
        this.mqttAdapter = C_AREA.mqttAdapter;

        webService  = C_AREA.webService ; 

        this.server = this.app.listen(HTTP_PORT, () => {
            let host = this.server.address().address;
            let port = this.server.address().port;
          
            console.info("[WebController] web server started port %s", HTTP_PORT);
        });
    }



    getResPacket(rcd = 0, rms='', data={}) {
        return { rcd:rcd, rms:rms, data:data };
    }



    makeDataRespons(rows, isSingleData = false) {
        
        let resdata = this.getResPacket();
        if (isSingleData) {
            if (rows && rows.length > 0)
                resdata.data = rows[0];
        }
        else {
            resdata.data = rows;
        }
        return resdata;
    }

    makeErrorResponse(rcd, rms) {        
        return this.getResPacket(1, rms.message, rms );
    }

    sendMqtt( message ){    
        this.mqttAdapter.sendMessage( `${message}`);    
    }

    makeMqttMessage( cmd, cmd_param ){

        let obj = {
            "pkn"  : 1,	            //M=패킷구분  			[0:통보(응답불필요),1:요청(응답요구),2:요청(응답불필요),3:응답 ]	                    
            "cmd"  : cmd,	        //M=명령종류  				
            "tno"  : 0, 	        //M=트랜잭션번호 		
            "data" : JSON.parse(cmd_param) 
        };
        return  JSON.stringify(obj);
    }



}


module.exports = new WebController();
