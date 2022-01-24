

function main(){
  
    // fetch xml from url
    // parse xml data
    // get database listings
    // compare both -> get listings that needs to be updated and listings that are new
    // update data into db
  
  }

function google_drive()
{
  let folder_id ="1PGNZtxYhBJpFpo95ynhqHKiWRViXHj2I"
  let driven_dir = DriveApp.getFolderById(folder_id)


  let  old_data_obj = {}

  let backup_file = driven_dir.getFilesByName("backup_external_data.json");

  while(backup_file.hasNext())
  {
    let file = backup_file.next();
    var content = file.getBlob().getDataAsString();
    var json = JSON.parse(content);

    for(listing of json)
    {
      old_data_obj[listing["Property_Ref_No"]] = listing
    }
  }

  let new_data = []

  let response = fetch_external_data()

  let new_parsed_data = parse_external_data(response)

  driven_dir.createFile("backup_external_data.json",response.getBlob())





  
}


function fetch_external_data()
{
  let xml_url = "https://crm.drivenproperties.ae/portals/xml/driven.xml"

  let response = UrlFetchApp.fetch(xml_url);

  return response
}

function parse_external_data(response){
  let parsed_listings = [];

  let doc = XmlService.parse(response.getContentText());

  let root = doc.getRootElement()

  let listings = root.getChildren("Listing")

  listings.forEach(item =>{
      let parsed_data = {};
      item.getChildren().forEach(child => {
        let childName = child.getName();
        if(childName == "Listing_Date" || childName == "Last_Updated")
        {
          parsed_data[childName] = new Date(child.getValue())
        }
        else if(childName == "Images")
        {
          let images = [];
          child.getChildren().forEach(image => {
            images.push(image.getValue())
          })
          parsed_data[childName]  = images;
          //  image
        }
        else if(childName == "Facilities")
        {
          let facilities = []
          child.getChildren().forEach(facility => {
            facilities.push(facility.getValue())
          })
          parsed_data[childName]  = facilities;
          //  facility
        }
        else {
          parsed_data[childName] = child.getValue();
        }
        })
      parsed_listings.push(parsed_data)
  })

  return parsed_listings  

}

function get_db_listings()
{
  let url = "https://driven-properties-strapi.herokuapp.com/api/listings"
  let headers = {
  'Authorization': 'Bearer 808ecf94f37d0946eee90be1e73e40d5d827563a372821a514dbf930ef9075df6a23aaaf64d8d5952dbbfacad59681314a32758243635de48cfa2c291db961ac4bd2ed71ae569f7c404c8be3de8ec0e2785d9d83c08327d1d5edca1760e6d22aa9d37b3ff5963eff47ed0d96eebd040d599e57fc4e90ca1aedce0efd364d8af7',
  'Content-Type': 'application/json'
}

let options = {
    "headers":headers
  }

var response = UrlFetchApp.fetch(url,options)

let data = JSON.parse(response.getContentText())



}

function myFunction() {
  let xml_url = "https://crm.drivenproperties.ae/portals/xml/driven.xml"

  let response = UrlFetchApp.fetch(xml_url);

  let doc = XmlService.parse(response.getContentText());

  let root = doc.getRootElement()

  let listings = root.getChildren("Listing")

  let item = listings[0];

  let parsed_data = {};
   item.getChildren().forEach(child => {
     let childName = child.getName();
     if(childName == "Listing_Date" || childName == "Last_Updated")
     {
       parsed_data[childName] = new Date(child.getValue())
     }
     else if(childName == "Images")
     {
       let images = [];
       child.getChildren().forEach(image => {
         images.push(image.getValue())
       })
       parsed_data[childName]  = images;
      //  image
     }
     else if(childName == "Facilities")
     {
       let facilities = []
       child.getChildren().forEach(facility => {
         facilities.push(facility.getValue())
       })
       parsed_data[childName]  = facilities;
      //  facility
     }
     else {
       parsed_data[childName] = child.getValue();
     }
    })

    Logger.log(parsed_data);
  // listings.forEach(item => {
  //   item.getChildren().forEach(child => {
  //     Logger.log(child.getValue())
  //   })
  //   // Logger.log(item.getChildren("Ad_Type")[0].getValue())

  

  // })



  // Logger.log(listings)

}
