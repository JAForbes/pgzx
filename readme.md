# pgzx

_[google/zx](https://github.com/google/zx) with builtin support for [postgres.js](https://github.com/porsager/postgres)_

## What

- zx is a library that makes writing shell scripts in node.js _very nice_
- postgres.js is a library that makes using postgres in node.js _very nice_
- pgzx is a library that makes writing shell scripts that use postgres in node.js _very nice_

## Quick Start

```bash
# Run a migration script with full access to zx and sql globals
npx pgzx "$DATABASE_URL" migration.pg.js
```

```js
// migration.pg.js
const [{ a, b }] = await sql`select 1 as a, 2 as b`

const files = await $`ls -la`

console.log(chalk.green('Migration OK'))
```

## Options

```
Usage: pgzx [CONNECTION] [PGOPTIONS] [ZXOPTIONS]
Version: ${pkg.version}

[CONNECTION]

- Pass a postgres connection string (just like psql)
- AND/OR Specify host/user etc as env flags (PGHOST, PGUSER, PGPORT)

[PGOPTIONS]

--begin                     Run entire script within a single transaction (default=false)

Connection Options:

The only way to specify a connection is via a pg connection URL.  

If you do no want to connect to a database, you can pass the -X flag.

-X, --no-connect            Do not establish a connection automatically

--ssl 
    | --ssl                 Enables ssl
    | --ssl=prefer          Prefers ssl
    | --ssl=require         Requires ssl
    | --ssl=reject          Reject unauthorized connections
    | --ssl=no-reject       Do not reject unauthorized connections
    | --ssl=heroku          --ssl-no-reject if the host ends with a .com
    
    For more detailed connection options, connect to postgres manually
    via -X


[ZXOPTIONS]

--quiet                     Run zx commands quietly
--shell                     Override the shell used by $
--prefix                    Prefix shell commands with an other command
```

## Why

I've been writing migrations in psql (the shell scripting language offered by postgres).  It gets you very far but at a certain point it is beneficial to have some higher level language constructs to do some basic checks and balances that migrations require.  

I've also recently been using zx more and more for operations scripts and finding it to be a lot more reliable than other alternatives (and also it is pretty fun!).

Most of my scripts need to talk to the DB, and it was getting annoying manually specifying connection options in a way that would work locally and remotely at the top of every script.  In the spirit of ZX (including commonly used things as globals).  This package simply includes postgres.js by default and provides a few other postgres specific options (auto transactions).

I think pgfx could be a solid foundation for a basic migration system, and maybe that will come in a future package.

## Options


_Note the following is lifted almost verbatim from google/zx's documentation with a few edits to adapt for usage with postgres, please checkout out google/zx repo for the latest documentation._

## CLI Options

### SSL

A brief explanation of the many SSL flags and options.  The short of it is, we would all really like to enforce ssl but many hosting providers do not support SSL connections out of the box.  So if you are on heroku for example, you may want to `--ssl=heroku`.  It uses `--ssl` if the host ends with a `.com`, otherwise `ssl` is disabled.

At such a time when Heroku supports SSL, this flag will change behaviour to `--ssl`, so its a good default for heroku users.

For more information on SSL connection configuration in postgres checkout the [postgres.js SSL documentation](https://github.com/porsager/postgres#ssl).

## Script Usage

### ``sql`SQLCOMMAND` ``

Checkout [postgres.js' excellent documentation](https://github.com/porsager/postgres#query-sql----promise) for a full walkthrough of what is possible with the `sql` and `pg` global

```js
const [user] = await sql`select * from users where user_id = ${1}`
```


### postgres.js extensions

`sql.onnotice` can be assigned during a script to control server notices.

Inside a migration, you may not want to be notified when severity is 'notice'.  Because the sql instance is preconfigured for you we provide the ability to dynmaically bind sql.onnotice at runtime.

```js
sql.onnotice = x => {
    if(x.severity == 'NOTICE') return;
    console.log(x)
}
sql`
create extension if not exists pgcrypto;
`
// later...
//
// revert to default (console.log)
sql.onnotice = null
```


### ``$`command` ``

Executes a given string using the `spawn` function from the
`child_process` package and returns `ProcessPromise<ProcessOutput>`.

```js
let count = parseInt(await $`ls -1 | wc -l`)
console.log(`Files count: ${count}`)
```

For example, to upload files in parallel:

```js
let hosts = [...]
await Promise.all(hosts.map(host =>
  $`rsync -azP ./src ${host}:/var/www`
))
```

If the executed program returns a non-zero exit code,
`ProcessOutput` will be thrown.

```js
try {
  await $`exit 1`
} catch (p) {
  console.log(`Exit code: ${p.exitCode}`)
  console.log(`Error: ${p.stderr}`)
}
```

#### `ProcessPromise`

```ts
class ProcessPromise<T> extends Promise<T> {
  readonly stdin: Writable
  readonly stdout: Readable
  readonly stderr: Readable
  readonly exitCode: Promise<number>
  pipe(dest): ProcessPromise<T>
}
```

The `pipe()` method can be used to redirect stdout:

```js
await $`cat file.txt`.pipe(process.stdout)
```

Read more about [pipelines](examples/pipelines.md).

#### `ProcessOutput`

```ts
class ProcessOutput {
  readonly stdout: string
  readonly stderr: string
  readonly exitCode: number
  toString(): string
}
```

### Functions

#### `cd()`

Changes the current working directory.

```js
cd('/tmp')
await $`pwd` // outputs /tmp
```

#### `fetch()`

A wrapper around the [node-fetch](https://www.npmjs.com/package/node-fetch) package.

```js
let resp = await fetch('http://wttr.in')
if (resp.ok) {
  console.log(await resp.text())
}
```

#### `question()`

A wrapper around the [readline](https://nodejs.org/api/readline.html) package.

Usage:

```js
let bear = await question('What kind of bear is best? ')
let token = await question('Choose env variable: ', {
  choices: Object.keys(process.env)
})
```

In second argument, array of choices for Tab autocompletion can be specified.

```ts
function question(query?: string, options?: QuestionOptions): Promise<string>
type QuestionOptions = { choices: string[] }
```

#### `sleep()`

A wrapper around the `setTimeout` function.

```js
await sleep(1000)
```

#### `nothrow()`

Changes behavior of `$` to not throw an exception on non-zero exit codes.

```ts
function nothrow<P>(p: P): P
```

Usage:

```js
await nothrow($`grep something from-file`)

// Inside a pipe():

await $`find ./examples -type f -print0`
  .pipe(nothrow($`xargs -0 grep something`))
  .pipe($`wc -l`)
```

If only the `exitCode` is needed, you can use the next code instead:

```js
if (await $`[[ -d path ]]`.exitCode == 0) {
  ...
}

// Equivalent of:

if ((await nothrow($`[[ -d path ]]`)).exitCode == 0) {
  ...
}
```

### Packages

Packages are available without importing inside scripts.

#### `postgres` package

The [postgres](https://www.npmjs.com/package/postgres) package.

```js
// Available globally as both pg and postgres
const sql = postgres(connectionOptions)
```

#### `chalk` package

The [chalk](https://www.npmjs.com/package/chalk) package.

```js
console.log(chalk.blue('Hello world!'))
```

#### `fs` package

The [fs-extra](https://www.npmjs.com/package/fs-extra) package.

```js
let content = await fs.readFile('./package.json')
```

#### `os` package

The [os](https://nodejs.org/api/os.html) package.

```js
await $`cd ${os.homedir()} && mkdir example`
```

#### `minimist` package

The [minimist](https://www.npmjs.com/package/minimist) package.

Available as global const `argv`.

### Configuration

#### `$.shell`

Specifies what shell is used. Default is `which bash`.

```js
$.shell = '/usr/bin/bash'
```

Or use a CLI argument: `--shell=/bin/bash`

#### `$.prefix`

Specifies the command that will be prefixed to all commands run.

Default is `set -euo pipefail;`.

Or use a CLI argument: `--prefix='set -e;'`

#### `$.quote`

Specifies a function for escaping special characters during
command substitution.

#### `$.verbose`

Specifies verbosity. Default is `true`.

In verbose mode, the `pgzx` prints all executed commands alongside with their
outputs.

Or use a CLI argument `--quiet` to set `$.verbose = false`.

### Polyfills

#### `__filename` & `__dirname`

In [ESM](https://nodejs.org/api/esm.html) modules, Node.js does not provide
`__filename` and `__dirname` globals. As such globals are really handy in scripts,
`pgzx` provides these for use in `.mjs` files (when using the `pgzx` executable).

#### `require()`

In [ESM](https://nodejs.org/api/modules.html#modules_module_createrequire_filename)
modules, the `require()` function is not defined.
The `pgzx` provides `require()` function, so it can be used with imports in `.mjs`
files (when using `pgzx` executable).

```js
let {version} = require('./package.json')
```

### FAQ

#### Passing env variables

```js
process.env.FOO = 'bar'
await $`echo $FOO`
```

#### Passing array of values

If array of values passed as argument to `$`, items of the array will be escaped
individually and concatenated via space.

Example:
```js
let files = [...]
await $`tar cz ${files}`
```

#### Importing from other scripts

It is possible to make use of `$` and other functions via explicit imports:

```js
#!/usr/bin/env node
import {$} from 'pgzx'
await $`date`
```

#### Unsupported ZX features

These features were ommited without prejudice.  They simply weren't available as exports on the zx library and things are a lot simpler if script execution is managed by pgzx not zx.  Will happily accept PRs to add these features back.

- Scripts without extensions
- Markdown scripts
- TypeScript support
- Stdin scripts

## License

All non referenced documentation and new code uses the [MIT Licence](https://opensource.org/licenses/MIT)

All referenced code and language used in this documentation from google/zx uses the Apache 2.0 Licence:

[google/zx - Apache Licence 2.0](https://github.com/google/zx/blob/main/LICENSE)

## Acknowledgements

Infinite thanks to the authors of [google/zx](https://github.com/google/zx) and [porsager/postgres](https://github.com/porsager/postgres), this package is merely a thin abstraction on top of 2 incredible API surfaces.

I never thought anyone would pry me away from bash or psql scripts but zx and postgres together create a very compelling scripting environment for migrations and operations.  

Without these two packages this package would never exist.