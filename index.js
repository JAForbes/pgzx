#!/usr/bin/env node

import * as zx from 'zx'
import * as M from 'module'
import * as URL from 'url'
import * as PATH from 'path'
import pg from 'postgres'

const require = M.createRequire(import.meta.url)
const pkg = require('./package.json')

const help = 
`
Usage: pgzx [CONNECTION] [PGOPTIONS] [ZXOPTIONS]
Version: ${pkg.version}

[CONNECTION]

- Pass a postgres connection string (just like psql)
- AND/OR Specify host/user etc as env flags (PGHOST, PGUSER, PGPORT)

[PGOPTIONS]

--begin                     Run entire script within a single transaction (default=false)

Connection Options:

Specify a connection via a pg connection URL.

If you do no want to connect to a database, you can pass the -X flag.

-X, --no-connect            Do not establish a connection automatically

--ssl 
    | --ssl                 Enables ssl
    | --ssl=prefer          Prefers ssl
    | --ssl=require         Requires ssl
    | --ssl=reject          Reject unauthorized connections
    | --ssl=no-reject       Do not reject unauthorized connections
    | --ssl=heroku          --no-ssl-reject if the host ends with a .com
    
    For more detailed connection options, connect to postgres manually
    via -X

Advanced:

--sql-max                   Max number of connections (default:10)
--sql-idle-timeout          Idle connection timeout in seconds (default:0)
--sql-connect-timeout       Idle connection timeout in seconds (default:30)
--sql-prepare               Automatic creation of prepared statements (default:false)
--sql-var a=2 b="hello"     Specify a connection parameter

[ZXOPTIONS]

--quiet                     Run zx commands quietly
--shell                     Override the shell used by $
--prefix                    Prefix shell commands with an other command
`

function parseOptions(args){
    
    let [connectionString, script] = args._

    if (!script) {
        script = connectionString
        connectionString = null
    }

    let { 
        X=false
        , connect=!X
        , ssl:theirSSL
        , begin=false
        , ...rest
    } = args

    let sqlOptions = {}
    {
        let { 
            'sql-max':max
            , 'sql-idle-timeout': idle_timeout
            , 'sql-connect-timeout': connect_timeout
            , 'sql-prepare': prepare
            , no_prepare=!prepare
            , 'sql-var': vars
            , ...rest2  
        } = rest

        rest = rest2
        
        const connection = 
            vars.reduce( (p,n) => {
                const [k,v] = n.split('=')
                try { p[k] = JSON.parse(v) } catch (e) { p[k] = v }
                return p
            }, {})

        
        for(let [k,v] of Object.entries({ max, idle_timeout, connect_timeout, no_prepare, connection })){
            if ( typeof v !== 'undefined' ) {
                sqlOptions[k] = v
            }
        }
        
    }
    
    if ( theirSSL == 'heroku' ) {
        let hosts = []
        if (process.env.PGHOST) {
            hosts = process.env.PGHOST.split(',')
        } else if (connectionString ) {
            hosts = 
                connectionString.split('@')[1].split('/')[0].split(',').map( x => x.split(':')[0])
        }

        theirSSL =
            hosts.every( x => x.endsWith('.com') ) 
            ? 'no-reject'
            : false
    }

    const ssl = 
        theirSSL == 'no-reject'
            ? { rejectUnauthorized: false }
        : theirSSL == 'reject'
            ? { rejectUnauthorized: true }
        // inspired by: https://github.com/porsager/postgres/blob/master/lib/index.js#L577
        : theirSSL !== 'disabled' && theirSSL !== false && theirSSL

    const pg = 
        connect
        ? [
            connectionString, { ssl, ...sqlOptions }
        ]
        .filter(Boolean)
        : null

    return {
        pg, begin, connectionString, script, ...args, ...rest
    }
}

class RequiredScriptMissingError extends Error {}

async function main(){
    if( process.argv.length == 2 ){
        console.log(help)
        process.exit(1)
    }
    let options = parseOptions(zx.argv)

    if(options.pg) {
        const sql =
            pg(...options.pg)

        global.sql = sql
    }
    global.pg = global.postgres = pg

    const tx = 
        options.pg && options.begin
        ? sql.begin
        : f => f()

    let scriptPath;

    if (options.script) {
        if (options.script.startsWith('http://') || options.script.startsWith('https://')) {
            scriptPath = options.script
        } else {
            
            if (options.script.startsWith('/')) {
                scriptPath = options.script
            } else if (options.script.startsWith('file:///')) {
                scriptPath = URL.fileURLToPath(options.script)
            } else {
                scriptPath = PATH.join(process.cwd(), options.script)
            }
        }
    }

    if (scriptPath) {
        await tx( async () => 
            import(scriptPath)    
        )
        .finally( () => sql.end() )
    } else {
        throw new RequiredScriptMissingError()
    }

    await sql.end()
}


main()
.catch( 
    e => {
        if ($.verbose) {
            console.log('error', e)
        }
    }
)
