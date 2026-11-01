# Store listing in other languages

Paste each block into the Developer Dashboard: Store listing → the language dropdown at the top → pick the language → Description.

The **summary** of a listing comes from the manifest's `description`, which is `"__MSG_appDescription__"`: the dashboard takes each language's `appDescription` from `extension/_locales/<lang>/messages.json` (each fits the 132-character limit), so it changes with the package, not here. The summaries below are copies of those for reference. Português do Brasil has no locale in the extension, so the dashboard shows the English summary there; the one below is ready for a `pt_BR` locale.

Every summary and description follows the store metadata rule in `store/listing.md`: no list of mail service or company names. Gmail is named only where a Gmail feature is described, the rest are "other mail services", and the website lists them. The note on the other services' interfaces, the privacy part and the open-source line are the same in meaning as the English listing; the product name, the licence name and the URL stay as they are. "Settings → Other mail" uses the names the extension's settings page shows in that language.

## Русский (ru)

**Summary:** Непрочитанная почта из всех ящиков, в которые вы вошли, в одной быстрой панели. Читайте, архивируйте, удаляйте без новых вкладок.

```
Mail Deck собирает непрочитанные письма из всех ящиков, в которые вы вошли, в одну панель на панели инструментов.

Расширение работает через сеанс, который уже есть в браузере, так же как веб-страница каждого почтового сервиса: без пароля, без пароля приложения, без OAuth и без наших серверов. Gmail работает сразу. Ещё несколько популярных почтовых веб-сервисов можно включить в разделе «Настройки» → «Другая почта»; Chrome попросит разрешить доступ к сайтам этого сервиса, а при выключении разрешение снимается. Какие сервисы поддерживает Mail Deck, указано на его сайте.

Нажмите на письмо, чтобы прочитать его прямо в панели. Письмо можно отметить прочитанным, отправить в архив, удалить или пометить как спам, не открывая вкладку. Нажмите на ящик, чтобы открыть его на сайте сервиса.

Возможности
- Все ящики, в которые вы вошли, у каждого свой цвет, в том порядке, в какой вы их перетащите
- Переписка целиком прямо в панели, вместе с вложениями
- Gmail: до десяти аккаунтов, поиск по всем аккаунтам, звёздочки, выбранные ярлыки или только вкладка «Несортированные» и видеовстреча в один клик
- «Напомнить позже»: уберите письмо до вечера, до завтра или до следующей недели
- Прочитать, архивировать, удалить или пометить как спам из панели или уведомления, с отменой
- Картинки в письмах других сервисов загружаются, только когда вы об этом попросите
- Уведомления и звук по желанию, с тихими часами, тихими ящиками и правилами для отправителей
- Боковая панель, горячая клавиша и одна клавиша на каждое действие
- Светлая и тёмная тема, как в системе
- Резервная копия настроек в файл или в синхронизацию Chrome
- Бесплатно, без ограничений на число аккаунтов и без платных тарифов

У других почтовых сервисов нет для этого публичного интерфейса, поэтому Mail Deck обращается к ним так же, как их собственные веб-приложения, и изменение на их стороне может остановить сервис, пока Mail Deck не обновится.

Конфиденциальность
У Mail Deck нет своих серверов и аналитики. Расширение обращается только к Google и к почтовым сервисам, которые вы включили, через сеансы, которые уже есть в браузере, и почта каждого сервиса уходит только в этот сервис. Оно никогда не спрашивает и не хранит ваш пароль, а настройки остаются в браузере.

Mail Deck — проект с открытым кодом под лицензией Mozilla Public License 1.1: https://github.com/nord-express/mail-deck
Расширение не создано ни одним почтовым провайдером и не связано ни с одним из них. Gmail — товарный знак Google LLC.
```

## Українська (uk)

**Summary:** Непрочитана пошта з усіх скриньок, у які ви ввійшли, в одній швидкій панелі. Читайте, архівуйте й видаляйте без нових вкладок.

```
Mail Deck збирає непрочитані листи з усіх скриньок, у які ви ввійшли, в одну панель на панелі інструментів.

Розширення працює через сеанс, який уже є у браузері, так само як вебсторінка кожного поштового сервісу: без пароля, без пароля застосунку, без OAuth і без наших серверів. Gmail працює одразу. Ще кілька популярних поштових вебсервісів можна ввімкнути в розділі «Налаштування» → «Інша пошта»; Chrome попросить дозволити доступ до сайтів цього сервісу, а коли ви його вимкнете, дозвіл буде знято. Які сервіси підтримує Mail Deck, зазначено на його сайті.

Натисніть на лист, щоб прочитати його просто в панелі. Лист можна позначити прочитаним, архівувати, видалити або позначити як спам, не відкриваючи вкладку. Натисніть на скриньку, щоб відкрити її на сайті сервісу.

Можливості
- Усі скриньки, у які ви ввійшли, кожна зі своїм кольором, у тому порядку, у який ви їх перетягнете
- Усе листування просто в панелі, разом із вкладеннями
- Gmail: до десяти акаунтів, пошук в усіх акаунтах, зірочки, вибрані мітки або лише вкладка «Основні» та відеозустріч в один клік
- «Нагадати пізніше»: відкладіть лист до вечора, до завтра або до наступного тижня
- Прочитати, архівувати, видалити або позначити як спам з панелі чи сповіщення, зі скасуванням
- Зображення в листах інших сервісів завантажуються, лише коли ви про це попросите
- Сповіщення і звук за бажанням, з тихими годинами, тихими скриньками та правилами для відправників
- Бічна панель, гаряча клавіша й одна клавіша на кожну дію
- Світла й темна тема, як у системі
- Резервна копія налаштувань у файл або в синхронізацію Chrome
- Безкоштовно, без обмежень на кількість акаунтів і без платних тарифів

Інші поштові сервіси не мають для цього публічного інтерфейсу, тож Mail Deck звертається до них так само, як їхні власні вебзастосунки, і зміна з їхнього боку може зупинити сервіс, доки Mail Deck не оновиться.

Конфіденційність
У Mail Deck немає власних серверів і аналітики. Розширення звертається лише до Google і до поштових сервісів, які ви ввімкнули, через сеанси, які вже є у браузері, і пошта кожного сервісу йде лише до нього. Воно ніколи не запитує і не зберігає ваш пароль, а налаштування залишаються у браузері.

Mail Deck — проєкт із відкритим кодом за ліцензією Mozilla Public License 1.1: https://github.com/nord-express/mail-deck
Розширення не створене жодним поштовим провайдером і не пов'язане з жодним із них. Gmail — торговельна марка Google LLC.
```

## Deutsch (de)

**Summary:** Ungelesene Mails aller Postfächer, in denen du angemeldet bist, im schnellen Panel. Lesen, archivieren, löschen ohne neuen Tab.

```
Mail Deck holt die ungelesenen Mails aller Postfächer, in denen du angemeldet bist, in ein Fenster in der Symbolleiste.

Es nutzt die Sitzung, die dein Browser schon hat, so wie die Webseite jedes E-Mail-Dienstes selbst: kein Passwort, kein App-Passwort, kein OAuth, keine Server von uns. Gmail funktioniert sofort. Mehrere andere beliebte Webmail-Dienste lassen sich unter Einstellungen → Weitere E-Mail-Dienste einschalten; Chrome fragt dann, ob du die Seiten dieses Dienstes erlaubst, und beim Ausschalten wird die Berechtigung wieder entzogen. Welche Dienste Mail Deck unterstützt, steht auf der Website.

Klicke auf eine Mail, um sie direkt im Fenster zu lesen. Du kannst sie als gelesen markieren, archivieren, löschen oder als Spam melden, ohne einen Tab zu öffnen. Ein Klick auf ein Postfach öffnet es auf der Seite des Dienstes.

Funktionen
- Alle angemeldeten Postfächer, jedes in eigener Farbe und in der Reihenfolge, in die du sie ziehst
- Ganze Unterhaltungen im Fenster, samt Anhängen
- Gmail: bis zu zehn Konten, Suche in allen Konten, Sterne, ausgewählte Labels oder nur der Tab „Allgemein“ und eine Videobesprechung mit einem Klick
- Später erinnern: eine Mail bis heute Abend, morgen oder nächste Woche beiseitelegen
- Lesen, archivieren, löschen oder als Spam melden im Fenster oder in einer Benachrichtigung, mit Rückgängig
- Bilder in Mails anderer Dienste werden erst geladen, wenn du darum bittest
- Benachrichtigungen und ein optionaler Ton, mit Ruhezeiten, stummen Postfächern und Regeln für Absender
- Seitenleiste, ein Tastenkürzel und eine Taste pro Aktion
- Helles und dunkles Design, passend zum System
- Sicherung der Einstellungen als Datei oder in der Chrome-Synchronisierung
- Kostenlos, ohne Kontolimit und ohne Bezahlversion

Die anderen E-Mail-Dienste haben dafür keine öffentliche Schnittstelle. Mail Deck folgt deshalb ihren eigenen Web-Apps, und eine Änderung auf ihrer Seite kann einen Dienst stoppen, bis Mail Deck aktualisiert ist.

Datenschutz
Mail Deck hat keine eigenen Server und keine Analyse. Es spricht nur mit Google und mit den E-Mail-Diensten, die du einschaltest, jeweils über die Sitzung, die dein Browser schon hat, und die Mails jedes Dienstes gehen nur an diesen Dienst. Es fragt nie nach deinem Passwort und speichert es nicht, und deine Einstellungen bleiben in deinem Browser.

Mail Deck ist Open Source unter der Mozilla Public License 1.1: https://github.com/nord-express/mail-deck
Es stammt von keinem E-Mail-Anbieter und ist mit keinem verbunden. Gmail ist eine Marke von Google LLC.
```

## Español (es)

**Summary:** Correo sin leer de todos los buzones con sesión iniciada, en un panel rápido. Léelo, archívalo o elimínalo sin abrir pestañas.

```
Mail Deck reúne en un panel de la barra de herramientas el correo sin leer de todos los buzones en los que has iniciado sesión.

Funciona con la sesión que tu navegador ya tiene, igual que la propia página web de cada servicio de correo: sin contraseña, sin contraseña de aplicación, sin OAuth y sin servidores nuestros. Gmail funciona desde el primer momento. Otros servicios populares de correo web se pueden activar en Configuración → Otro correo; Chrome te pedirá que permitas los sitios de ese servicio, y al desactivarlo se retira el permiso. El sitio web indica qué servicios admite Mail Deck.

Haz clic en un mensaje para leerlo en el propio panel. Puedes marcarlo como leído, archivarlo, eliminarlo o denunciarlo como spam sin abrir ninguna pestaña. Haz clic en un buzón para abrirlo en el sitio del servicio.

Funciones
- Todos los buzones con sesión iniciada, cada uno con su color y en el orden en que los arrastres
- Conversaciones completas en el panel, con los archivos adjuntos
- Gmail: hasta diez cuentas, búsqueda en todas las cuentas, destacados, las etiquetas que elijas o solo la pestaña Principal, y una videorreunión con un clic
- Recordar más tarde: aparta un mensaje hasta esta tarde, mañana o la semana que viene
- Leer, archivar, eliminar o denunciar spam desde el panel o una notificación, con opción de deshacer
- Las imágenes del correo de otros servicios solo se cargan cuando las pides
- Notificaciones y un sonido opcional, con horas de silencio, buzones silenciados y reglas por remitente
- Panel lateral, un atajo de teclado y una tecla para cada acción
- Tema claro y oscuro, según tu sistema
- Copia de seguridad de los ajustes en un archivo o en la sincronización de Chrome
- Gratis, sin límite de cuentas y sin versión de pago

Los demás servicios de correo no tienen una interfaz pública para esto, así que Mail Deck sigue sus propias aplicaciones web, y un cambio por su parte puede detener alguno de ellos hasta que Mail Deck se actualice.

Privacidad
Mail Deck no tiene servidores propios ni analítica. Solo se comunica con Google y con los servicios de correo que actives, cada uno con la sesión que tu navegador ya tiene, y el correo de cada servicio solo va a ese servicio. Nunca pide ni guarda tu contraseña, y tus ajustes se quedan en tu navegador.

Mail Deck es de código abierto con la licencia Mozilla Public License 1.1: https://github.com/nord-express/mail-deck
No está hecho por ningún proveedor de correo ni está afiliado a ninguno. Gmail es una marca comercial de Google LLC.
```

## Français (fr)

**Summary:** Les non-lus de toutes vos boîtes connectées, dans un panneau rapide. Lisez, archivez ou supprimez sans ouvrir d'onglet.

```
Mail Deck rassemble dans un panneau de la barre d'outils les e-mails non lus de toutes les boîtes auxquelles vous êtes connecté.

Il passe par la session que votre navigateur a déjà, comme la page web de chaque messagerie elle-même : pas de mot de passe, pas de mot de passe d'application, pas d'OAuth, pas de serveurs à nous. Gmail fonctionne tout de suite. Plusieurs autres webmails populaires peuvent être activés dans Paramètres → Autres messageries ; Chrome vous demande alors d'autoriser les sites de ce service, et le désactiver retire l'autorisation. Le site web indique les services pris en charge par Mail Deck.

Cliquez sur un message pour le lire directement dans le panneau. Vous pouvez le marquer comme lu, l'archiver, le supprimer ou le signaler comme spam sans ouvrir d'onglet. Cliquez sur une boîte de réception pour l'ouvrir sur le site du service.

Fonctionnalités
- Toutes les boîtes connectées, chacune avec sa couleur et dans l'ordre où vous les faites glisser
- Conversations entières dans le panneau, pièces jointes comprises
- Gmail : jusqu'à dix comptes, recherche dans tous les comptes, messages suivis, libellés choisis ou seulement l'onglet Principale, et une réunion vidéo en un clic
- Me le rappeler plus tard : mettez un message de côté jusqu'à ce soir, demain ou la semaine prochaine
- Lire, archiver, supprimer ou signaler comme spam depuis le panneau ou une notification, avec annulation
- Les images des e-mails des autres services ne se chargent que si vous le demandez
- Notifications et son facultatif, avec heures calmes, boîtes silencieuses et règles par expéditeur
- Panneau latéral, raccourci clavier et une touche par action
- Thème clair et sombre, selon votre système
- Sauvegarde des réglages dans un fichier ou dans la synchronisation Chrome
- Gratuit, sans limite de comptes et sans version payante

Les autres messageries n'ont pas d'interface publique pour cela : Mail Deck suit donc leurs propres applications web, et un changement de leur côté peut arrêter l'une d'elles jusqu'à une mise à jour de Mail Deck.

Confidentialité
Mail Deck n'a ni serveurs ni outils d'analyse. Il ne communique qu'avec Google et avec les messageries que vous activez, chacune grâce à la session déjà ouverte dans votre navigateur, et le courrier de chaque service ne va qu'à ce service. Il ne demande ni ne stocke jamais votre mot de passe, et vos réglages restent dans votre navigateur.

Mail Deck est open source sous licence Mozilla Public License 1.1 : https://github.com/nord-express/mail-deck
Il n'est ni conçu par un fournisseur de messagerie, ni affilié à l'un d'eux. Gmail est une marque de Google LLC.
```

## Italiano (it)

**Summary:** Posta non letta di tutte le caselle a cui hai eseguito l'accesso, in un pannello veloce. Leggi, archivia o elimina senza schede.

```
Mail Deck raccoglie in un pannello della barra degli strumenti la posta non letta di tutte le caselle a cui hai eseguito l'accesso.

Usa la sessione che il browser ha già, come la pagina web di ciascun servizio di posta: niente password, niente password per le app, niente OAuth, nessun server nostro. Gmail funziona subito. Diversi altri servizi di webmail popolari si possono attivare in Impostazioni → Altra posta; Chrome ti chiede di consentire i siti di quel servizio, e disattivandolo il permesso viene revocato. Il sito web elenca i servizi supportati da Mail Deck.

Fai clic su un messaggio per leggerlo direttamente nel pannello. Puoi segnarlo come letto, archiviarlo, eliminarlo o segnalarlo come spam senza aprire una scheda. Fai clic su una casella per aprirla sul sito del servizio.

Funzioni
- Tutte le caselle collegate, ognuna con il suo colore e nell'ordine in cui le trascini
- Conversazioni intere nel pannello, allegati compresi
- Gmail: fino a dieci account, ricerca in tutti gli account, stelle, etichette scelte o solo la scheda Principale, e una riunione video con un clic
- Ricordamelo più tardi: metti da parte un messaggio fino a stasera, domani o la settimana prossima
- Leggi, archivia, elimina o segnala come spam dal pannello o da una notifica, con annullamento
- Le immagini nella posta degli altri servizi si caricano solo quando lo chiedi
- Notifiche e un suono facoltativo, con ore di silenzio, caselle silenziose e regole per mittente
- Pannello laterale, una scorciatoia da tastiera e un tasto per ogni azione
- Tema chiaro e scuro, come il sistema
- Backup delle impostazioni su file o nella sincronizzazione di Chrome
- Gratuito, senza limiti di account e senza versione a pagamento

Gli altri servizi di posta non hanno un'interfaccia pubblica per questo, quindi Mail Deck segue le loro app web, e una modifica da parte loro può fermarne uno finché Mail Deck non viene aggiornato.

Privacy
Mail Deck non ha server propri né strumenti di analisi. Comunica solo con Google e con i servizi di posta che attivi, ognuno tramite la sessione già aperta nel browser, e la posta di ogni servizio va solo a quel servizio. Non chiede né conserva mai la tua password, e le impostazioni restano nel tuo browser.

Mail Deck è open source con licenza Mozilla Public License 1.1: https://github.com/nord-express/mail-deck
Non è realizzato da alcun fornitore di posta né affiliato ad alcuno di essi. Gmail è un marchio di Google LLC.
```

## Polski (pl)

**Summary:** Nieprzeczytana poczta ze wszystkich zalogowanych skrzynek w jednym szybkim panelu. Czytaj, archiwizuj i usuwaj bez nowej karty.

```
Mail Deck zbiera w jednym panelu na pasku narzędzi nieprzeczytaną pocztę ze wszystkich skrzynek, na których jesteś zalogowany.

Działa przez sesję, którą przeglądarka już ma, tak jak strona internetowa każdej usługi pocztowej: bez hasła, bez hasła aplikacji, bez OAuth i bez naszych serwerów. Gmail działa od razu. Kilka innych popularnych usług poczty internetowej można włączyć w Ustawieniach → Inna poczta; Chrome poprosi o zezwolenie na strony tej usługi, a wyłączenie jej cofa to uprawnienie. Usługi obsługiwane przez Mail Deck są wymienione na jego stronie internetowej.

Kliknij wiadomość, aby przeczytać ją w panelu. Możesz oznaczyć ją jako przeczytaną, zarchiwizować, usunąć lub zgłosić jako spam bez otwierania karty. Kliknij skrzynkę, aby otworzyć ją na stronie usługi.

Funkcje
- Wszystkie zalogowane skrzynki, każda w swoim kolorze i w kolejności, w jakiej je przeciągniesz
- Całe rozmowy w panelu, razem z załącznikami
- Gmail: do dziesięciu kont, wyszukiwanie we wszystkich kontach, gwiazdki, wybrane etykiety lub tylko karta Główne oraz spotkanie wideo jednym kliknięciem
- Przypomnij później: odłóż wiadomość do wieczora, do jutra albo do przyszłego tygodnia
- Czytaj, archiwizuj, usuwaj lub zgłaszaj spam z panelu albo z powiadomienia, z możliwością cofnięcia
- Obrazy w wiadomościach z innych usług wczytują się dopiero wtedy, gdy o to poprosisz
- Powiadomienia i opcjonalny dźwięk, z godzinami ciszy, wyciszonymi skrzynkami i regułami dla nadawców
- Panel boczny, skrót klawiszowy i jeden klawisz na każdą czynność
- Jasny i ciemny motyw, zgodnie z systemem
- Kopia zapasowa ustawień w pliku lub w synchronizacji Chrome
- Za darmo, bez limitu kont i bez płatnej wersji

Pozostałe usługi pocztowe nie mają do tego publicznego interfejsu, więc Mail Deck postępuje tak jak ich własne aplikacje internetowe, a zmiana po ich stronie może zatrzymać którąś z usług do czasu aktualizacji Mail Deck.

Prywatność
Mail Deck nie ma własnych serwerów ani analityki. Łączy się tylko z Google i z usługami pocztowymi, które włączysz, z każdą przez sesję, którą przeglądarka już ma, a poczta każdej usługi trafia tylko do niej. Nigdy nie prosi o hasło ani go nie przechowuje, a ustawienia zostają w przeglądarce.

Mail Deck jest otwartym oprogramowaniem na licencji Mozilla Public License 1.1: https://github.com/nord-express/mail-deck
Nie jest tworzony przez żadnego dostawcę poczty ani z żadnym z nich powiązany. Gmail jest znakiem towarowym Google LLC.
```

## Türkçe (tr)

**Summary:** Oturum açtığınız tüm posta kutularındaki okunmamış postalar hızlı bir panelde. Sekme açmadan okuyun, arşivleyin veya silin.

```
Mail Deck, oturum açtığınız tüm posta kutularındaki okunmamış postaları araç çubuğundaki tek bir panelde toplar.

Tarayıcınızda zaten açık olan oturumla, her e-posta hizmetinin kendi web sayfası gibi çalışır: şifre yok, uygulama şifresi yok, OAuth yok, bizim sunucularımız yok. Gmail hemen çalışır. Diğer birkaç popüler web postası hizmeti de Ayarlar → Diğer e-posta hizmetleri bölümünden etkinleştirilebilir; Chrome o hizmetin sitelerine izin vermenizi ister, kapattığınızda izin geri alınır. Mail Deck'in desteklediği hizmetler web sitesinde listelenir.

Bir iletiyi doğrudan panelde okumak için tıklayın. İletiyi sekme açmadan okundu olarak işaretleyebilir, arşivleyebilir, silebilir veya spam olarak bildirebilirsiniz. Bir posta kutusunu hizmetin sitesinde açmak için tıklayın.

Özellikler
- Oturum açılmış tüm posta kutuları, her biri kendi renginde ve sürüklediğiniz sırada
- Ekleriyle birlikte yazışmanın tamamı panelde
- Gmail: ona kadar hesap, tüm hesaplarda arama, yıldızlar, seçtiğiniz etiketler veya yalnızca Birincil sekmesi ve tek tıkla görüntülü toplantı
- Sonra hatırlat: bir iletiyi bu akşama, yarına veya gelecek haftaya kadar kenara koyun
- Panelden veya bir bildirimden okuma, arşivleme, silme veya spam bildirme, geri alma ile
- Diğer hizmetlerden gelen postalardaki resimler yalnızca siz istediğinizde yüklenir
- Bildirimler ve isteğe bağlı ses; sessiz saatler, sessiz kutular ve gönderen kurallarıyla
- Yan panel, bir klavye kısayolu ve her işlem için tek tuş
- Sisteminize uyan açık ve koyu tema
- Ayarların bir dosyaya veya Chrome senkronizasyonuna yedeklenmesi
- Ücretsiz, hesap sınırı ve ücretli sürüm yok

Diğer e-posta hizmetlerinin bunun için herkese açık bir arayüzü yoktur; bu yüzden Mail Deck onların kendi web uygulamalarını izler ve onların tarafındaki bir değişiklik, Mail Deck güncellenene kadar bir hizmeti durdurabilir.

Gizlilik
Mail Deck'in kendi sunucuları ve analitiği yoktur. Yalnızca Google ve etkinleştirdiğiniz e-posta hizmetleriyle, her biri için tarayıcınızda zaten açık olan oturumla konuşur ve her hizmetin postası yalnızca o hizmete gider. Şifrenizi asla istemez veya saklamaz, ayarlarınız tarayıcınızda kalır.

Mail Deck, Mozilla Public License 1.1 lisansıyla açık kaynaklıdır: https://github.com/nord-express/mail-deck
Hiçbir e-posta sağlayıcısı tarafından yapılmamıştır ve hiçbiriyle bağlantılı değildir. Gmail, Google LLC'nin ticari markasıdır.
```

## Nederlands (nl)

**Summary:** Ongelezen mail uit elke inbox waarop je bent ingelogd, in één snel paneel. Lees, archiveer of verwijder zonder nieuwe tab.

```
Mail Deck zet de ongelezen mail van elke inbox waarop je bent ingelogd in één paneel op de werkbalk.

Het werkt via de sessie die je browser al heeft, zoals de webpagina van elke maildienst zelf: geen wachtwoord, geen app-wachtwoord, geen OAuth, geen servers van ons. Gmail werkt meteen. Verschillende andere populaire webmaildiensten kun je aanzetten bij Instellingen → Andere mail; Chrome vraagt dan of je de sites van die dienst toestaat, en uitzetten trekt de toestemming weer in. Op de website staat welke diensten Mail Deck ondersteunt.

Klik op een bericht om het direct in het paneel te lezen. Je kunt het als gelezen markeren, archiveren, verwijderen of als spam melden zonder een tabblad te openen. Klik op een inbox om hem op de site van de dienst te openen.

Functies
- Alle ingelogde mailboxen, elk met een eigen kleur en in de volgorde waarin je ze sleept
- Hele gesprekken in het paneel, met bijlagen
- Gmail: tot tien accounts, zoeken in alle accounts, sterren, gekozen labels of alleen het tabblad Primair, en een videovergadering met één klik
- Later herinneren: leg een bericht weg tot vanavond, morgen of volgende week
- Lezen, archiveren, verwijderen of als spam melden vanuit het paneel of een melding, met ongedaan maken
- Afbeeldingen in mail van andere diensten laden pas als je erom vraagt
- Meldingen en een optioneel geluid, met stille uren, stille inboxen en regels voor afzenders
- Zijpaneel, een sneltoets en één toets per actie
- Licht en donker thema, zoals je systeem
- Back-up van je instellingen in een bestand of in Chrome-synchronisatie
- Gratis, zonder limiet op accounts en zonder betaalde versie

De andere maildiensten hebben hiervoor geen openbare interface. Mail Deck volgt daarom hun eigen webapps, en een wijziging aan hun kant kan een dienst stilleggen tot Mail Deck is bijgewerkt.

Privacy
Mail Deck heeft geen eigen servers en geen analyse. Het praat alleen met Google en met de maildiensten die je aanzet, elk via de sessie die je browser al heeft, en de mail van elke dienst gaat alleen naar die dienst. Het vraagt nooit naar je wachtwoord en bewaart het niet, en je instellingen blijven in je browser.

Mail Deck is open source onder de Mozilla Public License 1.1: https://github.com/nord-express/mail-deck
Het is niet gemaakt door of verbonden met welke mailprovider dan ook. Gmail is een handelsmerk van Google LLC.
```

## 日本語 (ja)

**Summary:** ログイン中のすべての受信トレイの未読メールを 1 つの高速パネルに。タブを開かずに読む、アーカイブ、削除。

```
Mail Deck は、ログインしているすべての受信トレイの未読メールを、ツールバーの 1 つのパネルにまとめます。

各メールサービスのウェブページと同じように、ブラウザにすでにあるセッションを使って動作します。パスワードもアプリ パスワードも OAuth も不要で、私たちのサーバーも介しません。Gmail はすぐに使えます。ほかにもいくつかの人気ウェブメール サービスを [設定] → [その他のメール] でオンにできます。Chrome がそのサービスのサイトへのアクセス許可を求め、オフにすると許可は取り消されます。Mail Deck が対応しているサービスの一覧はウェブサイトに掲載しています。

メールをクリックすると、パネル内でそのまま読めます。タブを開かずに、既読にする、アーカイブ、削除、迷惑メールとして報告ができます。メールボックスをクリックすると、そのサービスのサイトで開きます。

機能
- ログイン中のすべてのメールボックス。それぞれに色が付き、ドラッグで並べ替え可能
- 添付ファイルを含むスレッド全体をパネル内で表示
- Gmail: 最大 10 アカウント、全アカウントの検索、スター、選んだラベルまたはメインタブのみの表示、ワンクリックでビデオ会議
- 後でリマインド: メールを今夜、明日、来週まで一時的に非表示
- パネルや通知から既読、アーカイブ、削除、迷惑メール報告。元に戻すことも可能
- 他のサービスのメールに含まれる画像は、表示を選んだときだけ読み込み
- 通知と任意のサウンド。おやすみ時間、通知しないメールボックス、送信者ごとのルール付き
- サイドパネル、キーボード ショートカット、操作ごとに 1 つのキー
- システムに合わせたライト テーマとダーク テーマ
- 設定をファイルまたは Chrome の同期にバックアップ
- 無料。アカウント数の制限や有料プランはありません

その他のメールサービスにはこのための公開インターフェースがないため、Mail Deck は各サービスのウェブアプリと同じ方法で動作します。サービス側の変更により、Mail Deck が更新されるまでそのサービスが使えなくなることがあります。

プライバシー
Mail Deck は独自のサーバーも分析ツールも持ちません。通信するのは Google と、オンにしたメールサービスだけで、いずれもブラウザにすでにあるセッションを使います。各サービスのメールはそのサービスにだけ送られます。パスワードを尋ねたり保存したりすることはなく、設定はブラウザ内に保存されます。

Mail Deck は Mozilla Public License 1.1 のオープンソースです: https://github.com/nord-express/mail-deck
どのメール プロバイダが作成したものでもなく、いずれのメール プロバイダとも関係ありません。Gmail は Google LLC の商標です。
```

## 简体中文 (zh_CN)

**Summary:** 将你已登录的所有邮箱中的未读邮件集中到一个快速面板中。无需打开标签页，即可阅读、归档或删除。

```
Mail Deck 将你已登录的所有邮箱中的未读邮件，集中到工具栏上的一个面板中。

它像各邮件服务自己的网页一样，使用浏览器中已有的会话工作：无需密码、应用专用密码或 OAuth，也不经过我们的任何服务器。Gmail 安装后即可使用。另外几个常用的网页邮箱服务可以在“设置”→“其他邮箱”中开启；Chrome 会请求你允许访问该服务的网站，关闭后该权限即被移除。Mail Deck 支持的服务列表见其网站。

点击一封邮件，即可直接在面板中阅读。无需打开标签页，即可将其标为已读、归档、删除或举报为垃圾邮件。点击某个邮箱即可在该服务的网站中打开它。

功能
- 所有已登录的邮箱，每个邮箱一种颜色，可拖动调整顺序
- 在面板中查看完整会话，包括附件
- Gmail：最多十个账号，跨账号搜索，星标，选定的标签或仅“主要”标签页，一键发起视频会议
- 稍后提醒：把邮件暂时放到今晚、明天或下周
- 在面板或通知中阅读、归档、删除或举报垃圾邮件，并可撤销
- 其他服务邮件中的图片仅在你要求时才加载
- 新邮件通知和可选提示音，支持免打扰时段、静音邮箱和发件人规则
- 侧边栏、键盘快捷键，每个操作一个按键
- 浅色和深色主题，跟随系统
- 将设置备份到文件或 Chrome 同步
- 完全免费，不限账号数量，没有付费版本

其他邮件服务没有为此提供公开接口，因此 Mail Deck 采用与它们自己的网页应用相同的方式；如果这些服务做出改动，相应服务可能会停止工作，直到 Mail Deck 更新。

隐私
Mail Deck 没有自己的服务器，也不做任何统计分析。它只与 Google 和你开启的邮件服务通信，并且都使用浏览器中已有的会话；每个服务的邮件只发送到该服务。它从不询问或保存你的密码，你的设置只保存在浏览器中。

Mail Deck 采用 Mozilla Public License 1.1 开源：https://github.com/nord-express/mail-deck
本扩展并非由任何邮件服务提供商开发，也与它们无关。Gmail 是 Google LLC 的商标。
```

## Português do Brasil (pt_BR)

**Summary:** E-mails não lidos de todas as caixas em que você está conectado, em um painel rápido. Leia, arquive ou exclua sem abrir uma guia.

```
O Mail Deck reúne em um painel na barra de ferramentas os e-mails não lidos de todas as caixas de entrada em que você está conectado.

Ele funciona com a sessão que o navegador já tem, como a própria página web de cada serviço de e-mail: sem senha, sem senha de app, sem OAuth e sem servidores nossos. O Gmail funciona na hora. Vários outros serviços populares de webmail podem ser ativados em Configurações → Outros e-mails; o Chrome pede que você permita os sites desse serviço, e desativá-lo retira a permissão. O site lista os serviços compatíveis com o Mail Deck.

Clique em uma mensagem para lê-la no próprio painel. Você pode marcá-la como lida, arquivá-la, excluí-la ou denunciá-la como spam sem abrir uma guia. Clique em uma caixa de entrada para abri-la no site do serviço.

Recursos
- Todas as caixas de entrada conectadas, cada uma com sua cor e na ordem em que você arrastar
- Conversas inteiras no painel, com os anexos
- Gmail: até dez contas, pesquisa em todas as contas, estrelas, os marcadores escolhidos ou só a guia Principal, e uma reunião por vídeo com um clique
- Lembrar mais tarde: deixe uma mensagem de lado até hoje à noite, amanhã ou a próxima semana
- Ler, arquivar, excluir ou denunciar spam pelo painel ou por uma notificação, com opção de desfazer
- As imagens nos e-mails de outros serviços só carregam quando você pede
- Notificações e um som opcional, com horário silencioso, caixas silenciadas e regras por remetente
- Painel lateral, um atalho de teclado e uma tecla para cada ação
- Tema claro e escuro, de acordo com o sistema
- Backup das configurações em um arquivo ou na sincronização do Chrome
- Gratuito, sem limite de contas e sem versão paga

Os outros serviços de e-mail não têm uma interface pública para isso, então o Mail Deck segue os próprios apps web deles, e uma mudança do lado deles pode parar um serviço até o Mail Deck ser atualizado.

Privacidade
O Mail Deck não tem servidores próprios nem análises. Ele se comunica só com o Google e com os serviços de e-mail que você ativar, cada um com a sessão que o navegador já tem, e o e-mail de cada serviço vai só para esse serviço. Ele nunca pede nem guarda sua senha, e suas configurações ficam no navegador.

O Mail Deck é de código aberto sob a Mozilla Public License 1.1: https://github.com/nord-express/mail-deck
Ele não é feito por nenhum provedor de e-mail nem afiliado a nenhum deles. Gmail é uma marca registrada da Google LLC.
```

## العربية (ar)

**Summary:** البريد غير المقروء من كل صناديق البريد التي سجّلت الدخول إليها في لوحة واحدة سريعة. اقرأه أو أرشفه أو احذفه دون فتح علامة تبويب.

```
يجمع Mail Deck في لوحة واحدة على شريط الأدوات البريد غير المقروء من كل صناديق البريد التي سجّلت الدخول إليها.

يعمل عبر الجلسة الموجودة أصلًا في متصفحك، كما تفعل صفحة الويب الخاصة بكل خدمة بريد: لا كلمة مرور، ولا كلمة مرور للتطبيقات، ولا OAuth، ولا خوادم تابعة لنا. يعمل Gmail مباشرة. ويمكن تفعيل عدد من خدمات بريد الويب الشائعة الأخرى من الإعدادات ← بريد آخر؛ سيطلب منك Chrome السماح بمواقع تلك الخدمة، وعند إيقافها يُسحب الإذن. ويعرض موقع Mail Deck الخدمات التي يدعمها.

انقر على رسالة لتقرأها داخل اللوحة مباشرة. يمكنك تعليمها كمقروءة أو أرشفتها أو حذفها أو الإبلاغ عنها كرسالة غير مرغوب فيها دون فتح علامة تبويب. وانقر على صندوق بريد لفتحه على موقع خدمته.

الميزات
- كل صناديق البريد التي سجّلت الدخول إليها، لكلٍّ منها لونه الخاص، وبالترتيب الذي تختاره بالسحب
- المحادثات كاملة داخل اللوحة، مع المرفقات
- Gmail: حتى عشرة حسابات، والبحث في كل الحسابات، والنجوم، والتصنيفات التي تختارها أو علامة التبويب «الأساسية» فقط، واجتماع فيديو بنقرة واحدة
- «ذكّرني لاحقًا»: ضع الرسالة جانبًا حتى هذا المساء أو الغد أو الأسبوع القادم
- تعليم الرسائل كمقروءة وأرشفتها وحذفها والإبلاغ عن الرسائل غير المرغوب فيها من اللوحة أو من إشعار، مع إمكانية التراجع
- لا تُحمَّل الصور في رسائل الخدمات الأخرى إلا عندما تطلب ذلك
- إشعارات وصوت اختياري، مع ساعات الهدوء وصناديق بريد صامتة وقواعد حسب المرسل
- لوحة جانبية واختصار لوحة مفاتيح ومفتاح واحد لكل إجراء
- مظهر فاتح وآخر داكن يتبعان إعدادات نظامك
- نسخ احتياطي للإعدادات في ملف أو عبر مزامنة Chrome
- مجاني، بلا حدّ لعدد الحسابات وبلا أي نسخة مدفوعة

ليس لدى خدمات البريد الأخرى واجهة عامة لهذا الغرض، لذلك يتبع Mail Deck تطبيقات الويب الخاصة بها، وقد يوقف تغييرٌ من جهتها إحدى الخدمات إلى أن يُحدَّث Mail Deck.

الخصوصية
ليس لدى Mail Deck خوادم خاصة به ولا أدوات تحليلات. لا يتواصل إلا مع Google ومع خدمات البريد التي تفعّلها، مستخدمًا لكلٍّ منها الجلسة الموجودة أصلًا في متصفحك، ولا يذهب بريد كل خدمة إلا إليها. لا يطلب كلمة مرورك أبدًا ولا يخزّنها، وتبقى إعداداتك في متصفحك.

يتوفر Mail Deck كبرنامج مفتوح المصدر بموجب رخصة Mozilla Public License 1.1: https://github.com/nord-express/mail-deck
لم يطوّره أي مزوّد بريد وليس تابعًا لأيٍّ منهم. Gmail علامة تجارية لشركة Google LLC.
```

## Български (bg)

**Summary:** Непрочетената поща от всички кутии, в които сте влезли, в един бърз панел. Четете, архивирайте и изтривайте без нов раздел.

```
Mail Deck събира в един панел в лентата с инструменти непрочетената поща от всички пощенски кутии, в които сте влезли.

Работи чрез сесията, която браузърът ви вече има, както уеб страницата на всяка пощенска услуга: без парола, без парола за приложение, без OAuth и без наши сървъри. Gmail работи веднага. Още няколко популярни услуги за уеб поща могат да се включат от „Настройки“ → „Друга поща“; Chrome ще поиска да разрешите сайтовете на тази услуга, а изключването ѝ отнема разрешението. На уебсайта е посочено кои услуги поддържа Mail Deck.

Щракнете върху писмо, за да го прочетете направо в панела. Можете да го маркирате като прочетено, да го архивирате, да го изтриете или да подадете сигнал за спам, без да отваряте раздел. Щракнете върху пощенска кутия, за да я отворите в сайта на услугата.

Функции
- Всички пощенски кутии, в които сте влезли, всяка със свой цвят и в реда, в който ги подредите с плъзгане
- Цели разговори в панела, с прикачените файлове
- Gmail: до десет профила, търсене във всички профили, звезди, избрани етикети или само разделът „Основни“ и видеосреща с едно щракване
- „Напомняне по-късно“: отложете писмо до довечера, до утре или до следващата седмица
- Маркиране като прочетено, архивиране, изтриване и сигнал за спам от панела или от известие, с отмяна
- Изображенията в писмата от други услуги се зареждат само когато поискате
- Известия и звук по желание, с тихи часове, тихи пощенски кутии и правила за податели
- Страничен панел, клавишна комбинация и по един клавиш за всяко действие
- Светла и тъмна тема според системата
- Резервно копие на настройките във файл или в синхронизирането на Chrome
- Безплатно, без ограничение на броя профили и без платена версия

Другите пощенски услуги нямат публичен интерфейс за това, затова Mail Deck следва собствените им уеб приложения, а промяна от тяхна страна може да спре някоя услуга, докато Mail Deck не бъде обновен.

Поверителност
Mail Deck няма собствени сървъри и не използва аналитика. Разширението се свързва само с Google и с пощенските услуги, които включите, с всяка чрез сесията, която браузърът ви вече има, и пощата на всяка услуга отива само към нея. То никога не иска и не съхранява паролата ви, а настройките ви остават в браузъра.

Mail Deck е с отворен код под лиценза Mozilla Public License 1.1: https://github.com/nord-express/mail-deck
Разширението не е създадено от пощенски доставчик и не е свързано с никой от тях. Gmail е търговска марка на Google LLC.
```

## Català (ca)

**Summary:** Correu no llegit de totes les bústies amb la sessió iniciada, en un tauler ràpid. Llegeix, arxiva o suprimeix sense cap pestanya.

```
Mail Deck reuneix en un sol tauler de la barra d'eines el correu no llegit de totes les bústies amb què has iniciat la sessió.

Funciona amb la sessió que el navegador ja té, igual que la pàgina web de cada servei de correu: sense contrasenya, sense contrasenya d'aplicació, sense OAuth i sense servidors nostres. Gmail funciona de seguida. Uns quants serveis de correu web populars més es poden activar a Opcions → Altre correu; Chrome et demanarà que permetis els llocs d'aquell servei, i desactivar-lo retira el permís. El lloc web indica quins serveis admet Mail Deck.

Fes clic en un missatge per llegir-lo al mateix tauler. Pots marcar-lo com a llegit, arxivar-lo, suprimir-lo o marcar-lo com a correu brossa sense obrir cap pestanya. Fes clic en una bústia per obrir-la al lloc del servei.

Funcions
- Totes les bústies amb la sessió iniciada, cadascuna amb el seu color i en l'ordre en què les arrosseguis
- Converses senceres al tauler, amb els fitxers adjunts
- Gmail: fins a deu comptes, cerca a tots els comptes, estrelles, les etiquetes que triïs o només la pestanya «Principal», i una reunió de vídeo amb un clic
- «Recorda-m'ho més tard»: aparta un missatge fins aquesta tarda, fins demà o fins a la setmana que ve
- Marcar com a llegit, arxivar, suprimir o marcar com a correu brossa des del tauler o d'una notificació, amb opció de desfer
- Les imatges del correu d'altres serveis només es carreguen quan les demanes
- Notificacions i un so opcional, amb hores de silenci, bústies silenciades i regles per remitent
- Tauler lateral, una drecera de teclat i una tecla per a cada acció
- Tema clar i fosc, segons el sistema
- Còpia de seguretat de les opcions en un fitxer o a la sincronització de Chrome
- Gratuït, sense límit de comptes i sense cap versió de pagament

Els altres serveis de correu no tenen cap interfície pública per a això, així que Mail Deck segueix les seves pròpies aplicacions web, i un canvi per part seva en pot aturar un fins que Mail Deck s'actualitzi.

Privadesa
Mail Deck no té servidors propis ni cap eina d'analítica. Només es comunica amb Google i amb els serveis de correu que activis, cadascun amb la sessió que el navegador ja té oberta, i el correu de cada servei només va a aquell servei. Mai no et demana la contrasenya ni la desa, i les teves opcions es queden al navegador.

Mail Deck és de codi obert, amb la llicència Mozilla Public License 1.1: https://github.com/nord-express/mail-deck
No l'ha creat cap proveïdor de correu ni hi està vinculat. Gmail és una marca comercial de Google LLC.
```

## Ελληνικά (el)

**Summary:** Αδιάβαστα από κάθε γραμματοκιβώτιο όπου είστε συνδεδεμένοι, σε γρήγορο πλαίσιο. Διαβάστε, αρχειοθετήστε ή διαγράψτε χωρίς καρτέλες.

```
Το Mail Deck συγκεντρώνει σε έναν πίνακα στη γραμμή εργαλείων τα αδιάβαστα μηνύματα από όλα τα γραμματοκιβώτια στα οποία είστε συνδεδεμένοι.

Λειτουργεί μέσω της περιόδου σύνδεσης που έχει ήδη το πρόγραμμα περιήγησής σας, όπως η ίδια η ιστοσελίδα κάθε υπηρεσίας αλληλογραφίας: χωρίς κωδικό πρόσβασης, χωρίς κωδικό εφαρμογής, χωρίς OAuth και χωρίς δικούς μας διακομιστές. Το Gmail λειτουργεί αμέσως. Αρκετές άλλες δημοφιλείς υπηρεσίες webmail ενεργοποιούνται στις Ρυθμίσεις → Άλλη αλληλογραφία· το Chrome θα σας ζητήσει να επιτρέψετε τους ιστότοπους αυτής της υπηρεσίας, και η απενεργοποίηση αφαιρεί την άδεια. Ο ιστότοπος του Mail Deck αναφέρει ποιες υπηρεσίες υποστηρίζει.

Κάντε κλικ σε ένα μήνυμα για να το διαβάσετε μέσα στον πίνακα. Μπορείτε να το επισημάνετε ως αναγνωσμένο, να το αρχειοθετήσετε, να το διαγράψετε ή να το αναφέρετε ως spam χωρίς να ανοίξετε καρτέλα. Κάντε κλικ σε ένα γραμματοκιβώτιο για να το ανοίξετε στον ιστότοπο της υπηρεσίας.

Λειτουργίες
- Όλα τα γραμματοκιβώτια στα οποία είστε συνδεδεμένοι, το καθένα με δικό του χρώμα και με τη σειρά που ορίζετε σύροντάς τα
- Ολόκληρες συζητήσεις μέσα στον πίνακα, μαζί με τα συνημμένα
- Gmail: έως δέκα λογαριασμοί, αναζήτηση σε όλους τους λογαριασμούς, αστέρια, επιλεγμένες ετικέτες ή μόνο η καρτέλα «Κύρια», και βιντεοσύσκεψη με ένα κλικ
- «Υπενθύμιση αργότερα»: αφήστε ένα μήνυμα στην άκρη μέχρι σήμερα το απόγευμα, μέχρι αύριο ή μέχρι την επόμενη εβδομάδα
- Επισήμανση ως αναγνωσμένο, αρχειοθέτηση, διαγραφή ή αναφορά ως spam από τον πίνακα ή από μια ειδοποίηση, με δυνατότητα αναίρεσης
- Οι εικόνες στα μηνύματα άλλων υπηρεσιών φορτώνονται μόνο όταν το ζητήσετε
- Ειδοποιήσεις και προαιρετικός ήχος, με ώρες ησυχίας, σιωπηλά γραμματοκιβώτια και κανόνες ανά αποστολέα
- Πλαϊνός πίνακας, συντόμευση πληκτρολογίου και ένα πλήκτρο για κάθε ενέργεια
- Ανοιχτό και σκούρο θέμα, ανάλογα με το σύστημά σας
- Αντίγραφο ασφαλείας των ρυθμίσεων σε αρχείο ή στον συγχρονισμό του Chrome
- Δωρεάν, χωρίς όριο λογαριασμών και χωρίς έκδοση επί πληρωμή

Οι άλλες υπηρεσίες αλληλογραφίας δεν έχουν δημόσια διεπαφή για αυτό, γι' αυτό το Mail Deck ακολουθεί τις δικές τους εφαρμογές ιστού, και μια αλλαγή από την πλευρά τους μπορεί να σταματήσει μια υπηρεσία μέχρι να ενημερωθεί το Mail Deck.

Απόρρητο
Το Mail Deck δεν έχει δικούς του διακομιστές ούτε εργαλεία ανάλυσης. Επικοινωνεί μόνο με την Google και με τις υπηρεσίες αλληλογραφίας που ενεργοποιείτε, με την καθεμία μέσω της περιόδου σύνδεσης που έχει ήδη το πρόγραμμα περιήγησής σας, και η αλληλογραφία κάθε υπηρεσίας πηγαίνει μόνο σε αυτήν. Δεν ζητά ούτε αποθηκεύει ποτέ τον κωδικό πρόσβασής σας, και οι ρυθμίσεις σας μένουν στο πρόγραμμα περιήγησης.

Το Mail Deck είναι ανοιχτού κώδικα, με την άδεια Mozilla Public License 1.1: https://github.com/nord-express/mail-deck
Δεν έχει δημιουργηθεί από κανέναν πάροχο αλληλογραφίας και δεν συνδέεται με κανέναν από αυτούς. Το Gmail είναι εμπορικό σήμα της Google LLC.
```

## עברית (he)

**Summary:** הדואר שלא נקרא מכל התיבות שאליהן התחברתם, בחלונית מהירה אחת. קראו, העבירו לארכיון או מחקו בלי לפתוח כרטיסייה.

```
התוסף Mail Deck מרכז בחלונית אחת בסרגל הכלים את הדואר שלא נקרא מכל תיבות הדואר שאליהן התחברתם.

הוא עובד דרך ההתחברות שכבר פעילה בדפדפן, בדיוק כמו דף האינטרנט של כל שירות דואר: בלי סיסמה, בלי סיסמת אפליקציה, בלי OAuth ובלי שרתים שלנו. Gmail עובד מיד. כמה שירותי דואר אינטרנטי פופולריים נוספים אפשר להפעיל בהגדרות ← דואר אחר; Chrome יבקש מכם לאשר את האתרים של אותו שירות, וכיבוי השירות מבטל את ההרשאה. רשימת השירותים ש-Mail Deck תומך בהם נמצאת באתר שלו.

לחצו על הודעה כדי לקרוא אותה ישירות בחלונית. אפשר לסמן אותה כנקראה, להעביר אותה לארכיון, למחוק אותה או לדווח עליה כספאם בלי לפתוח כרטיסייה. לחצו על תיבת דואר כדי לפתוח אותה באתר השירות.

תכונות
- כל תיבות הדואר שאליהן התחברתם, כל אחת בצבע משלה ובסדר שתקבעו בגרירה
- שיחות שלמות בחלונית, כולל קבצים מצורפים
- Gmail: עד עשרה חשבונות, חיפוש בכל החשבונות, כוכבים, תוויות נבחרות או רק הכרטיסייה ״ראשי״, ופגישת וידאו בלחיצה אחת
- ״הזכר לי מאוחר יותר״: הניחו הודעה בצד עד הערב, עד מחר או עד השבוע הבא
- סימון כנקראה, העברה לארכיון, מחיקה ודיווח כספאם מהחלונית או מהתראה, עם אפשרות ביטול
- תמונות בדואר משירותים אחרים נטענות רק כשאתם מבקשים
- התראות וצליל לבחירה, עם שעות שקט, תיבות דואר שקטות וכללים לפי שולח
- חלונית צד, קיצור מקלדת ומקש אחד לכל פעולה
- ערכת נושא בהירה וכהה, בהתאם למערכת
- גיבוי ההגדרות לקובץ או לסנכרון של Chrome
- חינם, בלי הגבלה על מספר החשבונות ובלי גרסה בתשלום

לשירותי הדואר האחרים אין ממשק ציבורי לכך, ולכן Mail Deck פועל כמו אפליקציות האינטרנט שלהם עצמם, ושינוי בצד שלהם עלול לעצור שירות עד ש-Mail Deck יעודכן.

פרטיות
ל-Mail Deck אין שרתים משלו ואין כלי ניתוח נתונים. הוא מתקשר רק עם Google ועם שירותי הדואר שהפעלתם, כל אחד דרך ההתחברות שכבר פעילה בדפדפן שלכם, והדואר של כל שירות נשלח רק אליו. הוא אף פעם לא מבקש את הסיסמה שלכם ולא שומר אותה, וההגדרות שלכם נשארות בדפדפן.

הקוד של Mail Deck פתוח, ברישיון Mozilla Public License 1.1: https://github.com/nord-express/mail-deck
התוסף לא נוצר על ידי אף ספק דואר ואינו קשור לאף אחד מהם. Gmail הוא סימן מסחרי של Google LLC.
```

## Magyar (hu)

**Summary:** Minden bejelentkezett postafiók olvasatlan levelei egy gyors panelen. Olvasd, archiváld vagy töröld lapnyitás nélkül.

```
A Mail Deck egyetlen panelre gyűjti az eszköztáron az összes olyan postafiók olvasatlan leveleit, amelybe be vagy jelentkezve.

A böngésződben már meglévő munkamenettel működik, ugyanúgy, mint az egyes levelezőszolgáltatások saját weboldala: nincs jelszó, nincs alkalmazásjelszó, nincs OAuth, és nincsenek saját szervereink. A Gmail azonnal működik. Több más népszerű webes levelezőszolgáltatás is bekapcsolható a Beállítások → Más levelezőszolgáltatók részben; a Chrome engedélyt kér a szolgáltatás oldalaihoz, kikapcsoláskor pedig az engedély megszűnik. A weboldalon megtalálod, mely szolgáltatásokat támogatja a Mail Deck.

Kattints egy levélre, és magában a panelen olvashatod el. Olvasottnak jelölheted, archiválhatod, törölheted vagy spamként jelentheted anélkül, hogy lapot nyitnál. Ha egy postafiókra kattintasz, megnyílik a szolgáltatás oldalán.

Funkciók
- Az összes bejelentkezett postafiók, mindegyik saját színnel, abban a sorrendben, ahogy áthúzással elrendezed őket
- Teljes beszélgetések a panelen, a mellékletekkel együtt
- Gmail: legfeljebb tíz fiók, keresés az összes fiókban, csillagok, kiválasztott címkék vagy csak az „Elsődleges” lap, és videomegbeszélés egy kattintással
- „Emlékeztetés később”: tedd félre a levelet ma estig, holnapig vagy jövő hétig
- Olvasottnak jelölés, archiválás, törlés és spam bejelentése a panelről vagy egy értesítésből, visszavonási lehetőséggel
- A más szolgáltatásoktól érkező levelek képei csak kérésre töltődnek be
- Értesítések és választható hang, csendes órákkal, néma postafiókokkal és feladók szerinti szabályokkal
- Oldalsó panel, billentyűparancs és műveletenként egy billentyű
- Világos és sötét téma, a rendszerhez igazodva
- A beállítások biztonsági mentése fájlba vagy a Chrome-szinkronizálásba
- Ingyenes, fiókkorlát és fizetős változat nélkül

A többi levelezőszolgáltatás nem kínál ehhez nyilvános felületet, ezért a Mail Deck a saját webalkalmazásaikat követi, és egy változás az ő oldalukon leállíthat egy szolgáltatást, amíg a Mail Deck frissítést nem kap.

Adatvédelem
A Mail Deck nem rendelkezik saját szerverekkel, és nem használ analitikát. Csak a Google-lal és a bekapcsolt levelezőszolgáltatásokkal kommunikál, mindegyikkel a böngésződben már meglévő munkameneten keresztül, és minden szolgáltatás levelei csak az adott szolgáltatáshoz jutnak el. Soha nem kéri el és nem tárolja a jelszavadat, a beállításaid pedig a böngésződben maradnak.

A Mail Deck nyílt forráskódú, a Mozilla Public License 1.1 feltételei szerint: https://github.com/nord-express/mail-deck
Egyetlen levelezőszolgáltató sem készítette, és egyikkel sem áll kapcsolatban. A Gmail a Google LLC védjegye.
```

## Српски (sr)

**Summary:** Непрочитана пошта из свих сандучића на које сте пријављени, у брзом панелу. Читајте, архивирајте, бришите без нове картице.

```
Mail Deck окупља у један панел на траци с алаткама непрочитану пошту из свих сандучића на које сте пријављени.

Ради преко сесије коју ваш прегледач већ има, као и веб-страница сваког сервиса е-поште: без лозинке, без лозинке за апликацију, без OAuth-а и без наших сервера. Gmail ради одмах. Још неколико популарних сервиса веб-поште можете да укључите у Подешавањима → Друга пошта; Chrome ће затражити да дозволите сајтове тог сервиса, а искључивање повлачи дозволу. На веб-сајту пише које сервисе Mail Deck подржава.

Кликните на поруку да бисте је прочитали у самом панелу. Можете је означити као прочитану, архивирати, избрисати или пријавити као непожељну, без отварања картице. Кликните на сандуче да бисте га отворили на сајту сервиса.

Функције
- Сва сандучад на која сте пријављени, свако у својој боји и редоследом који одредите превлачењем
- Цела преписка у панелу, с прилозима
- Gmail: до десет налога, претрага свих налога, звездице, изабране ознаке или само картица „Примарно“ и видео-састанак једним кликом
- „Подсети ме касније“: склоните поруку до вечерас, до сутра или до следеће недеље
- Означавање као прочитано, архивирање, брисање и пријава непожељне поште из панела или из обавештења, уз опозив
- Слике у пошти других сервиса учитавају се тек када то затражите
- Обавештења и звук по избору, с тихим сатима, тихим сандучићима и правилима за пошиљаоце
- Бочна табла, пречица на тастатури и по један тастер за сваку радњу
- Светла и тамна тема, према систему
- Резервна копија подешавања у датотеци или у Chrome синхронизацији
- Бесплатно, без ограничења броја налога и без плаћене верзије

Остали сервиси е-поште немају јавни интерфејс за ово, па Mail Deck прати њихове сопствене веб-апликације, а промена на њиховој страни може да заустави неки сервис док се Mail Deck не ажурира.

Приватност
Mail Deck нема сопствене сервере ни аналитику. Комуницира само са Google-ом и са сервисима е-поште које укључите, са сваким преко сесије коју ваш прегледач већ има, а пошта сваког сервиса иде само том сервису. Никада не тражи и не чува вашу лозинку, а ваша подешавања остају у прегледачу.

Mail Deck је отвореног кода, под лиценцом Mozilla Public License 1.1: https://github.com/nord-express/mail-deck
Није га направио ниједан добављач е-поште и није повезан ни са једним од њих. Gmail је заштитни знак компаније Google LLC.
```
