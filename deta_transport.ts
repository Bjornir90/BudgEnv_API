import Transport from "winston-transport";
import {Deta} from "deta";
import Base from "deta/dist/types/base";
import TransportStream from "winston-transport";

interface DetaTransportOptions extends TransportStream.TransportStreamOptions {
    project_key: string;
    base_name: string;
}

class DetaTransport extends Transport {

    dbLog: Base;

    constructor(opts: DetaTransportOptions) {
        super(opts);
        const deta = Deta(opts.project_key);
        this.dbLog = deta.Base(opts.base_name);
    }
    log(info: any, callback: any) {
        this.dbLog.put(info);// Do not prevent further execution if log writing is in error
        callback();
    }
};

export default DetaTransport;