import {PGlite} from '@electric-sql/pglite';
import {writeFileSync} from 'node:fs';
const db=await PGlite.create();
await db.exec(`CREATE ROLE tester NOLOGIN NOSUPERUSER NOBYPASSRLS; CREATE TABLE invoices(id int primary key,user_id text); ALTER TABLE invoices ENABLE ROW LEVEL SECURITY; GRANT SELECT,UPDATE ON invoices TO tester; CREATE POLICY read_policy ON invoices FOR SELECT TO tester USING(true); CREATE POLICY update_policy ON invoices FOR UPDATE TO tester USING(user_id=current_setting('test.user')); INSERT INTO invoices VALUES(1,'alice'); SET ROLE tester; SELECT set_config('test.user','alice',false);`);
let result;try{await db.exec("UPDATE invoices SET user_id='bob' WHERE id=1");result={outcome:'unexpectedly_allowed'};}catch(e){result={outcome:'denied',code:e.code,message:e.message};}await db.close();writeFileSync('evidence/implicit-with-check-review.json',JSON.stringify(result,null,2));console.log(result);if(result.code!=='42501')process.exitCode=1;

