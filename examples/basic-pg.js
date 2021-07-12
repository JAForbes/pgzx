const [{a,b}] = await sql`
    select 1 as a, 2 as b
`

console.log(chalk.green(JSON.stringify({a,b})))

await $`ls -la`